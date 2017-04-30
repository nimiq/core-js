class Consensus extends Observable {

    constructor(broadcastChannel, blockchain, mempool) {
        super();
        this._agents = {};
        this._state = Consensus.State.UNKNOWN;

        broadcastChannel.on('peer-joined', peer => {
            const agent = new P2PAgent(peer);
            this._agents[peer.peerId] = agent;
            agent.on('consensus', () => this._onPeerConsensus(agent));
        });
        broadcastChannel.on('peer-left', peerId => {
            delete this._agents[peerId];
        });

        // Notify peers when our blockchain head changes.
        // TODO Only do this if our local blockchain has caught up with the consensus height.
        blockchain.on('head-changed', head => {
            InvVector.fromBlock(head)
                .then( vector => this._channel.inv([vector]));
        });

        // Relay new (verified) transactions to peers.
        mempool.on('transaction-added', tx => {
            InvVector.fromTransaction(tx)
                .then( vector => this._channel.inv([vector]));
        });
    }

    _onPeerConsensus(agent) {
        this.fire('established');
    }

    get state() {
        return this._state;
    }

    get established() {
        return this._state === Consensus.State.ESTABLISHED;
    }
}
Consensus.State = {};
Consensus.State.UNKNOWN = 'unknown';
Consensus.State.ESTABLISHED = 'established';
