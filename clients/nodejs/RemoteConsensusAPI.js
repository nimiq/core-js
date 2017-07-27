const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteConsensusAPI extends RemoteApiComponent {
    constructor($) {
        super($);
        $.consensus.on('established', () => this._broadcast(RemoteConsensusAPI.MessageTypes.CONSENSUS_ESTABLISHED));
        $.consensus.on('lost', () => this._broadcast(RemoteConsensusAPI.MessageTypes.CONSENSUS_LOST));
        $.consensus.on('syncing', targetHeight => this._broadcast(RemoteConsensusAPI.MessageTypes.CONSENSUS_SYNCING, targetHeight));
    }

    /** @overwrites */
    _isValidListenerType(type) {
        return type===RemoteConsensusAPI.MessageTypes.CONSENSUS_ESTABLISHED || type===RemoteConsensusAPI.MessageTypes.CONSENSUS_LOST
            || type===RemoteConsensusAPI.MessageTypes.CONSENSUS_SYNCING;
    }

    /** @overwrites */
    getState() {
        return {
            established: this.$.consensus.established
        };
    }
}
RemoteConsensusAPI.MessageTypes = {
    CONSENSUS_STATE: 'consensus',
    CONSENSUS_ESTABLISHED: 'consensus-established',
    CONSENSUS_LOST: 'consensus-lost',
    CONSENSUS_SYNCING: 'consensus-syncing'
};

module.exports = RemoteConsensusAPI;