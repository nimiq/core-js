/** @class Client.Network */
Client.Network = class Network {
    /**
     * @param {Client} client
     * @package
     */
    constructor(client) {
        this._client = client;
    }

    /**
     * @returns {Promise.<Array.<Client.PeerInfo>>} List of peers currently connected to this node.
     */
    async getPeers() {
        const consensus = await this._client._consensus;
        const infos = [];
        for (let connection of consensus.network.connections.valueIterator()) {
            infos.push(new Client.Network.PeerInfo(connection));
        }
        return infos;
    }

    /**
     * @param {PeerAddress|Client.Network.AddressInfo|string} address
     * @returns {Promise.<?Client.PeerInfo>}
     */
    async getPeer(address) {
        const consensus = await this._client._consensus;
        const connection = consensus.network.connections.getConnectionByPeerAddress(await this._toPeerAddress(address));
        if (connection) {
            return new Client.Network.PeerInfo(connection);
        }
        return null;
    }

    /**
     * @returns {Promise.<Array.<Client.AddressInfo>>} List of addresses known to this node.
     */
    async getAddresses() {
        const consensus = await this._client._consensus;
        const infos = [];
        for (let addressState of consensus.network.addresses.iterator()) {
            infos.push(new Client.Network.AddressInfo(addressState));
        }
        return infos;
    }

    /**
     * @param {PeerAddress|Client.Network.AddressInfo|string} address
     * @returns {Promise.<?Client.AddressInfo>}
     */
    async getAddress(address) {
        const consensus = await this._client._consensus;
        const addressState = consensus.network.addresses.getState(await this._toPeerAddress(address));
        if (addressState) {
            return new Client.Network.AddressInfo(addressState);
        }
        return null;
    }

    /**
     * @returns {Promise.<Client.BasicAddress>}
     */
    async getOwnAddress() {
        const consensus = await this._client._consensus;
        return new Client.BasicAddress(consensus.network.config.peerAddress);
    }

    /**
     * @returns {Promise.<Client.NetworkStatistics>} Statistics on the network
     */
    async getStatistics() {
        const consensus = await this._client._consensus;
        return new Client.NetworkStatistics(consensus.network);
    }

    /**
     * @param {PeerAddress|Client.Network.AddressInfo|string} address
     * @returns {Promise.<void>}
     */
    async connect(address) {
        const consensus = await this._client._consensus;
        consensus.network.connections.connectOutbound(await this._toPeerAddress(address));
    }

    /**
     * @param {PeerAddress|Client.Network.AddressInfo|string} address
     * @returns {Promise.<void>}
     */
    async disconnect(address) {
        const consensus = await this._client._consensus;
        const connection = consensus.network.connections.getConnectionByPeerAddress(await this._toPeerAddress(address));
        if (connection) {
            connection.peerChannel.close(CloseType.MANUAL_PEER_DISCONNECT);
        }
    }

    /**
     * @param {PeerAddress|Client.Network.AddressInfo|string} address
     * @returns {Promise.<void>}
     */
    async ban(address) {
        const consensus = await this._client._consensus;
        const peerAddress = await this._toPeerAddress(address);
        const connection = consensus.network.connections.getConnectionByPeerAddress(peerAddress);
        if (connection) {
            connection.peerChannel.close(CloseType.MANUAL_PEER_BAN);
        } else {
            const state = consensus.network.addresses.getState(peerAddress);
            state.state = PeerAddressState.BANNED;
        }
    }

    async unban(address) {
        const consensus = await this._client._consensus;
        const state = consensus.network.addresses.getState(await this._toPeerAddress(address));
        state.state = PeerAddressState.TRIED;
    }

    /**
     * @param {PeerAddress|Client.Network.AddressInfo|string} address
     * @returns {Promise.<PeerAddress>}
     */
    async _toPeerAddress(address) {
        const consensus = await this._client._consensus;
        let peerAddress;
        if (address instanceof PeerAddress) {
            peerAddress = consensus.network.addresses.get(address);
        } else if (address instanceof Client.Network.AddressInfo) {
            peerAddress = consensus.network.addresses.get(address.peerAddress);
        } else if (typeof address === 'string') {
            for (let peerAddressState of consensus.network.addresses.iterator()) {
                if (peerAddressState.peerAddress.toString() === address) {
                    peerAddress = peerAddressState.peerAddress;
                    break;
                }
            }
        }
        if (!peerAddress) throw new Error('Invalid or unknown peer address');
        return peerAddress;
    }
};

/** @class Client.BasicAddress */
Client.BasicAddress = class BasicAddress {
    /**
     * @param {PeerAddress} address
     */
    constructor(address) {
        this._address = address;
    }

    /** @type {PeerAddress} */
    get peerAddress() {
        return this._address;
    }

    /** @type {PeerId} */
    get peerId() {
        return this._address.peerId;
    }

    /** @type {Array.<String>} */
    get services() {
        return Services.toNameArray(Services.legacyProvideToCurrent(this._address.services));
    }

    /** @type {object} */
    toPlain() {
        return {
            peerAddress: this.peerAddress.toString(),
            peerId: this.peerId.toString(),
            services: this.services
        };
    }
};

/** @class Client.AddressInfo */
Client.AddressInfo = class AddressInfo extends Client.BasicAddress {
    /**
     * @param {PeerAddressState} addressState
     */
    constructor(addressState) {
        super(addressState.peerAddress);
        this._state = addressState.state;
    }

    /** @type {boolean} */
    get banned() {
        return this._state === PeerAddressState.BANNED;
    }

    /** @type {boolean} */
    get connected() {
        return this._state === PeerAddressState.ESTABLISHED;
    }

    /** @type {number} */
    get state() {
        return this._state;
    }

    /** @type {object} */
    toPlain() {
        const plain = super.toPlain();
        plain.banned = this.banned;
        plain.connected = this.connected;
        return plain;
    }
};

/** @class Client.PeerInfo */
Client.PeerInfo = class PeerInfo extends Client.BasicAddress {
    /**
     * @param {PeerConnection} connection
     */
    constructor(connection) {
        super(connection.peerAddress);
        this._connection = connection;
        this._bytesReceived = this._connection.networkConnection.bytesReceived;
        this._bytesSent = this._connection.networkConnection.bytesSent;
        this._latency = this._connection.statistics.latencyMedian;
        this._state = this._connection.state;
        this._version = this._connection.peer.version;
        this._score = this._connection.score;
        this._timeOffset = this._connection.peer.timeOffset;
        this._headHash = this._connection.peer.headHash;
        this._userAgent = this._connection.peer.userAgent;
    }

    /** @type {number} */
    get connectionSince() {
        return this._connection.establishedSince;
    }

    /** @type {NetAddress} */
    get netAddress() {
        return this._connection.networkConnection.netAddress;
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent;
    }

    /** @type {number} */
    get latency() {
        return this._latency;
    }

    /** @type {number} */
    get version() {
        return this._version;
    }

    /** @type {number} */
    get state() {
        return this._state;
    }

    /** @type {number} */
    get score() {
        return this._score;
    }

    /** @type {number} */
    get timeOffset() {
        return this._timeOffset;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /** @type {string} */
    get userAgent() {
        return this._userAgent;
    }

    /** @type {object} */
    toPlain() {
        const plain = super.toPlain();
        plain.connectionSince = this.connectionSince;
        plain.netAddress = this.netAddress.toString();
        plain.bytesReceived = this.bytesReceived;
        plain.bytesSent = this.bytesSent;
        plain.latency = this.latency;
        plain.version = this.version;
        plain.state = this.state;
        plain.score = this.score;
        plain.timeOffset = this.timeOffset;
        plain.headHash = this.headHash.toPlain();
        plain.userAgent = this.userAgent;
        return plain;
    }
};

/** @class Client.NetworkStatistics */
Client.NetworkStatistics = class NetworkStatistics {
    /**
     * @param {Network} network
     */
    constructor(network) {
        this._bytesReceived = network.bytesReceived;
        this._bytesSent = network.bytesSent;
        this._peerCounts = {
            total: network.peerCount,
            connecting: network.peerCountConnecting,
            dumb: network.peerCountDumb,
            rtc: network.peerCountWebRtc,
            ws: network.peerCountWebSocket,
            wss: network.peerCountWebSocketSecure
        };
        this._knownAddressesCounts = {
            total: network.knownAddressesCount,
            rtc: network.addresses.knownRtcAddressesCount,
            ws: network.addresses.knownWsAddressesCount,
            wss: network.addresses.knownWssAddressesCount
        };
        this._timeOffset = network.time.offset;
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent;
    }

    /** @type {number} */
    get totalPeerCount() {
        return this._peerCounts.total;
    }

    get peerCountsByType() {
        return this._peerCounts;
    }

    /** @type {number} */
    get totalKnownAddresses() {
        return this._knownAddressesCounts.total;
    }

    get knownAddressesByType() {
        return this._knownAddressesCounts;
    }

    /** @type {number} */
    get timeOffset() {
        return this._timeOffset;
    }

    /** @type {object} */
    toPlain() {
        return {
            bytesReceived: this.bytesReceived,
            bytesSent: this.bytesSent,
            totalPeerCount: this.totalPeerCount,
            peerCountsByType: this.peerCountsByType,
            totalKnownAddresses: this.totalKnownAddresses,
            knownAddressesByType: this.knownAddressesByType,
            timeOffset: this.timeOffset
        };
    }
};
