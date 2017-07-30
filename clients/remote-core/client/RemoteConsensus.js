class RemoteConsensus extends RemoteClass {
    /**
     * Construct a remote consensus connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     * @param live - if true, the consensus auto updates and requests an event listener itself
     */
    constructor(remoteConnection, live) {
        super(RemoteConsensus.IDENTIFIER, RemoteConsensus.ATTRIBUTES, RemoteConsensus.Events, remoteConnection);
        this.on(RemoteConsensus.Events.ESTABLISHED, () => this.established = true, !live);
        this.on(RemoteConsensus.Events.LOST, () => this.established = false, !live);
        this._remoteConnection.on(RemoteConnection.Events.CONNECTION_LOST, () => {
            this.established = false;
            this.fire(RemoteConsensus.Events.LOST);
        });
        this.on(RemoteClass.Events.INITIALIZED, () => setTimeout(() => {
            // fire a delayed consensus established event for listeners that have just registered at initialization
            if (this.established) {
                this.fire(RemoteConsensus.Events.ESTABLISHED);
            }
        }, 500));
    }

    /**
     * @async
     * @overwrite
     */
    _updateState() {
        return super._updateState().then(state => {
            if (state.established) {
                // fire the established event for the case that we were disconnected from the server and fired a consensus lost event
                this.fire(RemoteConsensus.Events.ESTABLISHED);
            }
            return state;
        });
    }
}
RemoteConsensus.IDENTIFIER = 'consensus';
RemoteConsensus.ATTRIBUTES = ['established'];
RemoteConsensus.Events = {
    ESTABLISHED: 'established',
    LOST: 'lost',
    SYNCING: 'syncing'
};
RemoteConsensus.MessageTypes = {
    CONSENSUS_ESTABLISHED: 'consensus-established',
    CONSENSUS_LOST: 'consensus-lost',
    CONSENSUS_SYNCING: 'consensus-syncing'
};

Class.register(RemoteConsensus);