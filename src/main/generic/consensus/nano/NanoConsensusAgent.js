class NanoConsensusAgent extends Observable {
    /**
     * @param {NanoChain} blockchain
     * @param {Mempool} mempool
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, peer) {
        super();
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Peer} */
        this._peer = peer;

        // Flag indicating that have synced our blockchain with the peer's.
        /** @type {boolean} */
        this._synced = false;

        // Helper object to keep track of timeouts & intervals.
        /** @type {Timers} */
        this._timers = new Timers();

        // Listen to consensus messages from the peer.
        peer.channel.on('chain-proof', msg => this._onChainProof(msg));
        //peer.channel.on('accounts-proof', msg => this._onAccountsProof(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());
    }

    /**
     * @returns {Promise.<void>}
     */
    syncBlockchain() {
        const headBlock = this._blockchain.getBlock(this._peer.headHash);
        if (!headBlock) {
            this._requestChainProof();
        } else {
            this._syncFinished();
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        this._synced = true;
        this.fire('sync');
    }

    /**
     * @returns {void}
     * @private
     */
    _requestChainProof() {
        Assert.that(!this._timers.timeoutExists('getChainProof'));

        // Request ChainProof from peer.
        this._peer.channel.getChainProof();

        // Drop the peer if it doesn't send the interlink chain within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getChainProof', () => {
            this._timers.clearTimeout('getChainProof');
            this._peer.channel.close('getChainProof timeout');
        }, NanoConsensusAgent.PROOF_REQUEST_TIMEOUT);
    }


    /**
     * @param {ChainProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onChainProof(msg) {
        Log.d(NanoConsensusAgent, `[CHAIN-PROOF] Received from ${this._peer.peerAddress}: ${msg.proof}`);

        // Check if we have requested an interlink chain, reject unsolicited ones.
        if (!this._timers.timeoutExists('getChainProof')) {
            Log.w(NanoConsensusAgent, `Unsolicited chain proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear timeout.
        this._timers.clearTimeout('getChainProof');

        // Check that chain proof ends with the peer's head block.
        const headHash = await msg.proof.head.hash();
        if (!this._peer.headHash.equals(headHash)) {
            Log.w(NanoConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - unexpected head`);
            // TODO ban instead?
            this._peer.channel.close('invalid chain proof');
            return;
        }

        // Push the proof into the NanoChain.
        if (!(await this._blockchain.pushProof(msg.proof))) {
            Log.w(NanoConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - verification failed`);
            // TODO ban instead?
            this._peer.channel.close('invalid chain proof');
            return;
        }

        this._syncFinished();
    }

    /**
     * @returns {void}
     * @private
     */
    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        this.fire('close', this);
    }

    /** @type {Peer} */
    get peer() {
        return this._peer;
    }

    /** @type {boolean} */
    get synced() {
        return this._synced;
    }
}
/**
 * Maximum time (ms) to wait for chainProof after sending out getChainProof before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.PROOF_REQUEST_TIMEOUT = 1000 * 10; // 10 seconds
Class.register(NanoConsensusAgent);
