const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteNetworkAPI extends RemoteApiComponent {
    /**
     * Create a new network API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
        $.network.on('peers-changed', () => this._broadcast(RemoteNetworkAPI.MessageTypes.NETWORK_PEERS_CHANGED, this.getState()));
        $.network.on('peer-joined', () => this._broadcast(RemoteNetworkAPI.MessageTypes.NETWORK_PEER_JOINED));
        $.network.on('peer-left', () => this._broadcast(RemoteNetworkAPI.MessageTypes.NETWORK_PEER_LEFT));
    }

    /** @overwrite */
    getState() {
        return {
            bytesReceived: this.$.network.bytesReceived,
            bytesSent: this.$.network.bytesSent,
            peerCount: this.$.network.peerCount,
            peerCountDumb: this.$.network.peerCountDumb,
            peerCountWebRtc: this.$.network.peerCountWebRtc,
            peerCountWebSocket: this.$.network.peerCountWebSocket
        };
    }

    /** @overwrite */
    _isValidListenerType(type) {
        const VALID_LISTENER_TYPES = [RemoteNetworkAPI.MessageTypes.NETWORK_PEERS_CHANGED, RemoteNetworkAPI.MessageTypes.NETWORK_PEER_JOINED,
            RemoteNetworkAPI.MessageTypes.NETWORK_PEER_LEFT];
        return VALID_LISTENER_TYPES.indexOf(type) !== -1;
    }
}
/** @enum */
RemoteNetworkAPI.MessageTypes = {
    NETWORK_STATE: 'network',
    NETWORK_PEERS_CHANGED: 'network-peers-changed',
    NETWORK_PEER_JOINED: 'network-peer-joined',
    NETWORK_PEER_LEFT: 'network-peer-left',
};

module.exports = RemoteNetworkAPI;