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
        this._clientsByIp = new HashMap();
        /** @type {HashMap.<NetAddress,number>} */
        this._clientsBySubnet = new HashMap();
        /** @type {number} */
        this._pendingUpgrades = 0;

        if (!networkConfig.reverseProxy.enabled) {
            server.on('connection', this._onNetSocketConnection.bind(this));
            this.on('connection', this._onWebSocketConnection.bind(this));
        }
    }

    _onNetSocketConnection(socket) {
        if (this._pendingUpgrades >= WebSocketServer.MAX_PENDING_UPGRADES) {
            Log.v(WebSocketServer, () => `Closing socket to ${socket.remoteAddress} - max pending upgrades exceeded`);
            socket.destroy();
            return;
        }

        // Track this client until the upgrade completes or it disconnects.
        this._addClient(socket);
    }

    _onWebSocketConnection(ws, req) {
        this._removeClient(req.connection);
    }

    _addClient(socket) {
        // Parse IP address.
        let netAddress;
        try {
            netAddress = NetAddress.fromIP(socket.remoteAddress, true);
        } catch (e) {
            Log.e(WebSocketServer, `Closing socket to ${socket.remoteAddress} - ${e.message || e}`);
            socket.destroy();
            return;
        }

        // Enforce max clients per ip/subnet.
        const subnet = netAddress.subnet(netAddress.isIPv4() ? Network.IPV4_SUBNET_MASK : Network.IPV6_SUBNET_MASK);
        const clientsByIp = this._clientsByIp.get(netAddress) || 0;
        const clientsBySubnet = this._clientsBySubnet.get(subnet) || 0;
        if (!netAddress.isPrivate() && (clientsByIp >= Network.PEER_COUNT_PER_IP_MAX || clientsBySubnet >= Network.INBOUND_PEER_COUNT_PER_SUBNET_MAX)) {
            Log.v(WebSocketServer, `Closing socket to ${socket.remoteAddress} - max peer count per ip/subnet exceeded`);
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

        const clientConnectionId = `${netAddress}|${socket.remotePort}`;
        this._clients.set(clientConnectionId, { listener, timeout });
        this._clientsByIp.put(netAddress, clientsByIp + 1);
        this._clientsBySubnet.put(subnet, clientsBySubnet + 1);
        this._pendingUpgrades++;
    }

    _removeClient(socket) {
        let netAddress = NetAddress.fromIP(socket.remoteAddress, true);
        const clientConnectionId = `${netAddress}|${socket.remotePort}`;

        const client = this._clients.get(clientConnectionId);
        // timeout and close event might be on the event-queue at the same time
        if (!client) return;
        this._clients.delete(clientConnectionId);

        clearTimeout(client.timeout);
        socket.off('close', client.listener);

        const subnet = netAddress.subnet(netAddress.isIPv4() ? Network.IPV4_SUBNET_MASK : Network.IPV6_SUBNET_MASK);
        const clientsByIp = this._clientsByIp.get(netAddress);
        const clientsBySubnet = this._clientsBySubnet.get(subnet);
        Assert.that(clientsByIp > 0 && clientsBySubnet > 0, 'clientsByIp/Subnet <= 0');

        if (clientsByIp === 1) {
            this._clientsByIp.remove(netAddress);
        } else {
            this._clientsByIp.put(netAddress, clientsByIp - 1);
        }

        if (clientsBySubnet === 1) {
            this._clientsBySubnet.remove(subnet);
        } else {
            this._clientsBySubnet.put(subnet, clientsBySubnet - 1);
        }

        this._pendingUpgrades--;
        Assert.that(this._pendingUpgrades >= 0, 'pendingUpgrades < 0');
    }
}
WebSocketServer.UPGRADE_TIMEOUT = 1000 * 10; // 10 seconds
WebSocketServer.TLS_HANDSHAKE_TIMEOUT = 1000 * 10; // 10 seconds
WebSocketServer.MAX_PENDING_UPGRADES = 100;
Class.register(WebSocketServer);
