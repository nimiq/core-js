class WebSocketServer extends WebSocket.Server {
    /**
     * @param {WsNetworkConfig|WssNetworkConfig} networkConfig
     * @returns {http.Server|https.Server}
     */
    static _newHttpServer(networkConfig) {
        if (networkConfig.secure) {
            const options = {
                key: fs.readFileSync(networkConfig.ssl.key),
                cert: fs.readFileSync(networkConfig.ssl.cert),
                handshakeTimeout: WebSocketServer.TLS_HANDSHAKE_TIMEOUT
            };
            return https.createServer(options, (req, res) => {
                res.writeHead(200);
                res.end('Nimiq Node.js Client\n');
            }).listen(networkConfig.port);
        } else {
            return http.createServer((req, res) => {
                res.writeHead(200);
                res.end('Nimiq Node.js Client\n');
            }).listen(networkConfig.port);
        }
    }

    /**
     * @param {WsNetworkConfig|WssNetworkConfig} networkConfig
     */
    constructor(networkConfig) {
        const server = WebSocketServer._newHttpServer(networkConfig);
        super({ server });

        /** @type {Map.<string,{listener:function(),timeout:*}>} */
        this._clients = new Map();

        /** @type {HashMap.<NetAddress,number>} */
        this._pendingClientsByIp = new HashMap();
        /** @type {HashMap.<NetAddress,number>} */
        this._pendingClientsBySubnet = new HashMap();
        /** @type {HashMap.<NetAddress,RateLimit>} */
        this._newConnectionsPerIp = new HashMap();
        /** @type {HashMap.<NetAddress,RateLimit>} */
        this._newConnectionsPerSubnet = new HashMap();

        /** @type {number} */
        this._pendingUpgrades = 0;

        if (!networkConfig.reverseProxy.enabled) {
            server.on('connection', this._onNetSocketConnection.bind(this));
            this.on('connection', this._onWebSocketConnection.bind(this));

            setInterval(this._housekeeping.bind(this), WebSocketServer.HOUSEKEEPING_INTERVAL);
        }
    }

    _onNetSocketConnection(socket) {
        // Track this client until the upgrade completes or it disconnects.
        this._addClient(socket);
    }

    _onWebSocketConnection(ws, req) {
        this._removeClient(req.connection);
    }

    _addClient(socket) {
        // Reject this client if we have too many pending upgrades.
        if (this._pendingUpgrades >= WebSocketServer.PENDING_UPGRADES_MAX) {
            Log.v(WebSocketServer, () => `Closing socket to ${socket.remoteAddress} - max pending upgrades exceeded`);
            socket.destroy();
            return;
        }

        // Parse IP address.
        let netAddress;
        try {
            netAddress = NetAddress.fromIP(socket.remoteAddress, true);
        } catch (e) {
            Log.e(WebSocketServer, `Closing socket to ${socket.remoteAddress} - ${e.message || e}`);
            socket.destroy();
            return;
        }

        // Reject if this ip:port is already pending.
        const clientConnectionId = `${netAddress}|${socket.remotePort}`;
        if (this._clients.has(clientConnectionId)) {
            Log.v(WebSocketServer, () => `Closing socket to ${socket.remoteAddress} - duplicate connection`);
            socket.destroy();
            return;
        }

        // Enforce max clients per ip/subnet.
        const subnet = netAddress.subnet(netAddress.isIPv4() ? Network.IPV4_SUBNET_MASK : Network.IPV6_SUBNET_MASK);
        const clientsByIp = this._pendingClientsByIp.get(netAddress) || 0;
        const clientsBySubnet = this._pendingClientsBySubnet.get(subnet) || 0;
        if (!netAddress.isPrivate() && (clientsByIp >= WebSocketServer.PENDING_UPGRADES_PER_IP_MAX || clientsBySubnet >=WebSocketServer.PENDING_UPGRADES_PER_SUBNET_MAX)) {
            Log.v(WebSocketServer, () => `Closing socket to ${socket.remoteAddress} - max peer count per ip/subnet exceeded`);
            socket.destroy();
            return;
        }

        // Enforce new connection rate limit per ip/subnet.
        let newConnectionsPerIp = this._newConnectionsPerIp.get(netAddress);
        if (!newConnectionsPerIp) {
            newConnectionsPerIp = new RateLimit(WebSocketServer.CONNECTION_RATE_LIMIT_PER_IP);
            this._newConnectionsPerIp.put(netAddress, newConnectionsPerIp);
        }
        let newConnectionsPerSubnet = this._newConnectionsPerSubnet.get(subnet);
        if (!newConnectionsPerSubnet) {
            newConnectionsPerSubnet = new RateLimit(WebSocketServer.CONNECTION_RATE_LIMIT_PER_SUBNET);
            this._newConnectionsPerSubnet.put(subnet, newConnectionsPerSubnet);
        }
        const newConnectionAllowedPerIp = newConnectionsPerIp.note();
        const newConnectionAllowedPerSubnet = newConnectionsPerSubnet.note();
        if (!newConnectionAllowedPerIp || !newConnectionAllowedPerSubnet) {
            Log.v(WebSocketServer, () => `Closing socket to ${socket.remoteAddress} - connection rate limit per ip/subnet exceeded`);
            socket.destroy();
            return;
        }

        // Remove this client if the socket is closed pre-upgrade.
        const listener = () => this._removeClient(socket);
        socket.on('close', listener);

        // Set upgrade timeout.
        const timeout = setTimeout(() => {
            Log.v(WebSocketServer, () => `Closing socket to ${socket.remoteAddress} - upgrade timeout`);
            this._removeClient(socket);
            socket.destroy();
        }, WebSocketServer.UPGRADE_TIMEOUT);

        this._clients.set(clientConnectionId, { listener, timeout, ts: Date.now() });
        this._pendingClientsByIp.put(netAddress, clientsByIp + 1);
        this._pendingClientsBySubnet.put(subnet, clientsBySubnet + 1);
        this._pendingUpgrades++;
    }

    _removeClient(socket) {
        const netAddress = NetAddress.fromIP(socket.remoteAddress, true);
        const clientConnectionId = `${netAddress}|${socket.remotePort}`;

        const client = this._clients.get(clientConnectionId);
        // Timeout and close event might be on the event-queue at the same time
        if (!client) {
            return;
        }
        this._clients.delete(clientConnectionId);

        clearTimeout(client.timeout);
        socket.removeListener('close', client.listener);

        const subnet = netAddress.subnet(netAddress.isIPv4() ? Network.IPV4_SUBNET_MASK : Network.IPV6_SUBNET_MASK);
        const clientsByIp = this._pendingClientsByIp.get(netAddress);
        const clientsBySubnet = this._pendingClientsBySubnet.get(subnet);
        Assert.that(clientsByIp > 0 && clientsBySubnet > 0, 'clientsByIp/Subnet <= 0');

        if (clientsByIp === 1) {
            this._pendingClientsByIp.remove(netAddress);
        } else {
            this._pendingClientsByIp.put(netAddress, clientsByIp - 1);
        }
        if (clientsBySubnet === 1) {
            this._pendingClientsBySubnet.remove(subnet);
        } else {
            this._pendingClientsBySubnet.put(subnet, clientsBySubnet - 1);
        }

        this._pendingUpgrades--;
        Assert.that(this._pendingUpgrades >= 0, 'pendingUpgrades < 0');
    }

    _housekeeping() {
        // Delete old rate limits.
        const now = Date.now();
        for (const ip of this._newConnectionsPerIp.keyIterator()) {
            const newConnections = this._newConnectionsPerIp.get(ip);
            if (newConnections.lastReset < now - WebSocketServer.LIMIT_TRACKING_AGE_MAX) {
                this._newConnectionsPerIp.remove(ip);
            }
        }
        for (const subnet of this._newConnectionsPerSubnet.keyIterator()) {
            const newConnections = this._newConnectionsPerSubnet.get(subnet);
            if (newConnections.lastReset < now - WebSocketServer.LIMIT_TRACKING_AGE_MAX) {
                this._newConnectionsPerSubnet.remove(subnet);
            }
        }
    }
}
WebSocketServer.UPGRADE_TIMEOUT = 1000 * 3; // 3 seconds
WebSocketServer.TLS_HANDSHAKE_TIMEOUT = 1000 * 3; // 3 seconds
WebSocketServer.PENDING_UPGRADES_MAX = 1000;
WebSocketServer.PENDING_UPGRADES_PER_IP_MAX = 2;
WebSocketServer.PENDING_UPGRADES_PER_SUBNET_MAX = 6;
WebSocketServer.CONNECTION_RATE_LIMIT_PER_IP = 10; // per minute
WebSocketServer.CONNECTION_RATE_LIMIT_PER_SUBNET = 30; // per minute
WebSocketServer.LIMIT_TRACKING_AGE_MAX = 1000 * 60 * 2; // 2 minutes
WebSocketServer.HOUSEKEEPING_INTERVAL = 1000 * 60 * 5; // 5 minutes
Class.register(WebSocketServer);
