class NanoConsensusAgent extends BaseMiniConsensusAgent {
    /**
     * @param {NanoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Time} time
     * @param {Peer} peer
     * @param {InvRequestManager} invRequestManager
     * @param {Subscription} targetSubscription
     */
    constructor(blockchain, mempool, time, peer, invRequestManager, targetSubscription) {
        super(blockchain, mempool, time, peer, invRequestManager, targetSubscription);
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {NanoMempool} */
        this._mempool = mempool;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        /** @type {boolean} */
        this._syncing = false;

        /** @type {Array.<BlockHeader>} */
        this._orphanedBlocks = [];

        // Flag to track chain proof requests.
        this._requestedChainProof = false;

        // Listen to consensus messages from the peer.
        this._onToDisconnect(peer.channel, 'chain-proof', msg => this._onChainProof(msg));
        this._onToDisconnect(peer.channel, 'get-chain-proof', msg => this._onGetChainProof(msg));

        // Subscribe to all announcements from the peer.
        this._subscribeTarget();
    }

    /**
     * @returns {Promise.<void>}
     */
    async syncBlockchain() {
        if (!this.providesServices(Services.CHAIN_PROOF)) {
            this._syncFinished();
            return;
        }

        this._syncing = true;

        const headBlock = await this._blockchain.getBlock(this._peer.headHash);
        if (!headBlock) {
            this._requestChainProof();
            this.fire('sync-chain-proof', this._peer.peerAddress);
        } else {
            this._syncFinished();
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        this._syncing = false;
        this._synced = true;

        this.requestMempool();

        this.fire('sync');
    }

    /**
     * @returns {void}
     * @private
     */
    _requestChainProof() {
        // Only one chain proof request at a time.
        if (this._requestedChainProof) {
            return;
        }

        // Request ChainProof from peer.
        this._peer.channel.getChainProof();
        this._requestedChainProof = true;

        // Drop the peer if it doesn't send the chain proof within the timeout.
        this._peer.channel.expectMessage(Message.Type.CHAIN_PROOF, () => {
            this._peer.channel.close(CloseType.GET_CHAIN_PROOF_TIMEOUT, 'getChainProof timeout');
        }, NanoConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT, NanoConsensusAgent.CHAINPROOF_CHUNK_TIMEOUT);
    }

    /**
     * @param {ChainProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onChainProof(msg) {
        Log.d(NanoConsensusAgent, `[CHAIN-PROOF] Received from ${this._peer.peerAddress}: ${msg.proof}`);

        // Check if we have requested a chain proof, discard unsolicited ones.
        if (!this._requestedChainProof) {
            Log.w(NanoConsensusAgent, `Unsolicited chain proof received from ${this._peer.peerAddress}`);
            return;
        }
        this._requestedChainProof = false;

        if (this._syncing) {
            this.fire('verify-chain-proof', this._peer.peerAddress);
        }

        // Push the proof into the NanoChain.
        if (!(await this._blockchain.pushProof(msg.proof))) {
            Log.w(NanoConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - verification failed`);
            this._peer.channel.close(CloseType.INVALID_CHAIN_PROOF, 'Invalid chain proof');
            return;
        }

        // TODO add all blocks from the chain proof to knownObjects.

        // Apply any orphaned blocks we received while waiting for the chain proof.
        await this._applyOrphanedBlocks();

        if (this._syncing) {
            this._syncFinished();
        }
    }

    /**
     * @returns {Promise.<void>}
     * @private
     */
    async _applyOrphanedBlocks() {
        for (const header of this._orphanedBlocks) {
            const status = await this._blockchain.pushHeader(header);
            if (status === NanoChain.ERR_INVALID) {
                this._peer.channel.close(CloseType.INVALID_BLOCK, 'received invalid block');
                break;
            }
        }
        this._orphanedBlocks = [];
    }

    _willRequestHeaders() {
        return true;
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks = false]
     * @param {boolean} [includeBody = false]
     * @returns {Promise.<?Block>}
     * @protected
     * @override
     */
    _getBlock(hash, includeForks = false, includeBody = false) {
        return this._blockchain.getBlock(hash, includeForks, includeBody);
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks = false]
     * @returns {Promise.<?Uint8Array>}
     * @protected
     * @override
     */
    _getRawBlock(hash, includeForks = false) {
        return this._blockchain.getRawBlock(hash, includeForks);
    }

    /**
     * @param {Hash} hash
     * @returns {?Transaction}
     * @protected
     * @override
     */
    _getTransaction(hash) {
        return this._mempool.getTransaction(hash);
    }

    /**
     * @param {Hash} hash
     * @param {BlockHeader} header
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processHeader(hash, header) {
        // TODO send reject message if we don't like the block
        const status = await this._blockchain.pushHeader(header);
        if (status === NanoChain.ERR_INVALID) {
            this._peer.channel.close(CloseType.INVALID_HEADER, 'received invalid header');
        }
        // Re-sync with this peer if it starts sending orphan blocks after the initial sync.
        else if (status === NanoChain.ERR_ORPHAN) {
            this._orphanedBlocks.push(header);
            if (this._synced) {
                this._requestChainProof();
            }
        }
    }

    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processTransaction(hash, transaction) {
        await this._mempool.pushTransaction(transaction);
    }

    /**
     * @param {GetChainProofMessage} msg
     * @private
     */
    async _onGetChainProof(msg) {
        const proof = await this._blockchain.getChainProof();
        if (proof) {
            this._peer.channel.chainProof(proof);
        }
    }

    /**
     * @returns {void}
     * @protected
     * @override
     */
    _onClose() {
        // Clear the synchronizer queue.
        this._synchronizer.clear();
        super._onClose();
    }

    /** @type {boolean} */
    get syncing() {
        return this._syncing;
    }
}
/**
 * Maximum time (ms) to wait for chain-proof after sending out get-chain-proof before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT = 1000 * 45;
/**
 * Maximum time (ms) to wait for between chain-proof chunks before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.CHAINPROOF_CHUNK_TIMEOUT = 1000 * 10;
Class.register(NanoConsensusAgent);
