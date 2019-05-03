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
     * @returns {Promise.<Client.BasicAddress>}
     */
    async getOwnAddress() {
        const consensus = await this._client._consensus;
        return new Client.BasicAddress(consensus.network.config.peerAddress);
    }

    /**
     * @returns {Promise<void>} Statistics on the network
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

    get peerAddress() {
        return this._address;
    }

    get peerId() {
        return this._address.peerId;
    }

    get services() {
        return Services.toNameArray(Services.legacyProvideToCurrent(this._address.services));
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

    get banned() {
        return this._state === PeerAddressState.BANNED;
    }

    get connected() {
        return this._state === PeerAddressState.ESTABLISHED;
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
    }

    get connectionSince() {
        return this._connection.establishedSince;
    }

    get netAddress() {
        return this._connection.networkConnection.netAddress;
    }

    get bytesReceived() {
        return this._bytesReceived;
    }

    get bytesSent() {
        return this._bytesSent;
    }

    get latency() {
        return this._latency;
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

    get bytesReceived() {
        return this._bytesReceived;
    }

    get bytesSent() {
        return this._bytesSent;
    }

    get totalPeerCount() {
        return this._peerCounts.total;
    }

    get peerCountsByType() {
        return this._peerCounts;
    }

    get totalKnownAddresses() {
        return this._knownAddressesCounts.total;
    }

    get knownAddressesByType() {
        return this._knownAddressesCounts;
    }

    get timeOffset() {
        return this._timeOffset;
    }

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
