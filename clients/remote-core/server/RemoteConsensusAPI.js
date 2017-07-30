const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteConsensusAPI extends RemoteApiComponent {
    /**
     * Create a new consensus API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
        $.consensus.on('established', () => this._broadcast(RemoteConsensusAPI.MessageTypes.CONSENSUS_ESTABLISHED));
        $.consensus.on('lost', () => this._broadcast(RemoteConsensusAPI.MessageTypes.CONSENSUS_LOST));
        $.consensus.on('syncing', targetHeight => this._broadcast(RemoteConsensusAPI.MessageTypes.CONSENSUS_SYNCING, targetHeight));
    }

    /** @overwrite */
    getState() {
        return {
            established: this.$.consensus.established
        };
    }

    /** @overwrite */
    _isValidListenerType(type) {
        return type===RemoteConsensusAPI.MessageTypes.CONSENSUS_ESTABLISHED || type===RemoteConsensusAPI.MessageTypes.CONSENSUS_LOST
            || type===RemoteConsensusAPI.MessageTypes.CONSENSUS_SYNCING;
    }
}
/** @enum */
RemoteConsensusAPI.MessageTypes = {
    CONSENSUS_STATE: 'consensus',
    CONSENSUS_ESTABLISHED: 'consensus-established',
    CONSENSUS_LOST: 'consensus-lost',
    CONSENSUS_SYNCING: 'consensus-syncing'
};

module.exports = RemoteConsensusAPI;