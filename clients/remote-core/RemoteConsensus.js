class RemoteConsensus extends RemoteClass {
    static get IDENTIFIER() { return 'consensus'; }
    static get ATTRIBUTES() { return ['established']; }
    static get EVENTS() {
        return {
            ESTABLISHED: 'established',
            LOST: 'lost',
            SYNCING: 'syncing'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            CONSENSUS_ESTABLISHED: 'consensus-established',
            CONSENSUS_LOST: 'consensus-lost',
            CONSENSUS_SYNCING: 'consensus-syncing'
        };
    }
    static get EVENT_MAP() {
        let map = {};
        map[RemoteConsensus.MESSAGE_TYPES.CONSENSUS_ESTABLISHED] = RemoteConsensus.EVENTS.ESTABLISHED;
        map[RemoteConsensus.MESSAGE_TYPES.CONSENSUS_LOST] = RemoteConsensus.EVENTS.LOST;
        map[RemoteConsensus.MESSAGE_TYPES.CONSENSUS_SYNCING] = RemoteConsensus.EVENTS.SYNCING;
        return map;
    }

    /**
     * Construct a remote consensus connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     * @param live - if true, the consensus auto updates and requests an event listener itself
     */
    constructor(remoteConnection, live) {
        super(RemoteConsensus.IDENTIFIER, RemoteConsensus.ATTRIBUTES, RemoteConsensus.EVENT_MAP, remoteConnection);
        this.on(RemoteConsensus.EVENTS.ESTABLISHED, () => this.established = true, !live);
        this.on(RemoteConsensus.EVENTS.LOST, () => this.established = false, !live);
        this._remoteConnection.on(RemoteConnection.EVENTS.CONNECTION_LOST, () => {
            this.established = false;
            this.fire(RemoteConsensus.EVENTS.LOST);
        });
        this._remoteConnection.on(RemoteConnection.EVENTS.CONNECTION_ESTABLISHED, async () => {
            await this._updateState();
            if (this.established) {
                this.fire(RemoteConsensus.EVENTS.ESTABLISHED);
            }
        });
    }
}