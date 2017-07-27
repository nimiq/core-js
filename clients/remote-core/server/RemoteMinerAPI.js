const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteMinerAPI extends RemoteApiComponent {
    /**
     * Create a new miner API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
        $.miner.on('start', () => this._broadcast(RemoteMinerAPI.MessageTypes.MINER_STARTED));
        $.miner.on('stop', () => this._broadcast(RemoteMinerAPI.MessageTypes.MINER_STOPPED));
        $.miner.on('hashrate-changed', hashrate => this._broadcast(RemoteMinerAPI.MessageTypes.MINER_HASHRATE_CHANGED, hashrate));
        $.miner.on('block-mined', block => this._broadcast(RemoteMinerAPI.MessageTypes.MINER_BLOCK_MINED, this._serializeToBase64(block)));
    }

    /** @overwrite */
    _isValidListenerType(type) {
        const VALID_LISTENER_TYPES = [RemoteMinerAPI.MessageTypes.MINER_STARTED, RemoteMinerAPI.MessageTypes.MINER_STOPPED,
            RemoteMinerAPI.MessageTypes.MINER_HASHRATE_CHANGED, RemoteMinerAPI.MessageTypes.MINER_BLOCK_MINED];
        return VALID_LISTENER_TYPES.indexOf(type) !== -1;
    }

    /** @overwrite */
    getState() {
        return {
            address: this.$.miner.address.toHex(),
            hashrate: this.$.miner.hashrate,
            working: this.$.miner.working
        };
    }
}
/** @enum */
RemoteMinerAPI.MessageTypes = {
    MINER_STATE: 'miner',
    MINER_STARTED: 'miner-started',
    MINER_STOPPED: 'miner-stopped',
    MINER_HASHRATE_CHANGED: 'miner-hashrate-changed',
    MINER_BLOCK_MINED: 'miner-block-mined',
};

module.exports = RemoteMinerAPI;