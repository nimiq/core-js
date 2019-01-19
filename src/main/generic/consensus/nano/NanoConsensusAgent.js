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
        super(blockchain, time, peer, invRequestManager, targetSubscription);
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
        peer.channel.on('chain-proof', msg => this._onChainProof(msg));

        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));

        // Subscribe to all announcements from the peer.
        this._subscribeTarget();
    }

    /**
     * @returns {Promise.<void>}
     */
    async syncBlockchain() {
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

        // Check if we have requested a chain proof, reject unsolicited ones.
        // FIXME
        if (!this._requestedChainProof) {
            Log.w(NanoConsensusAgent, `Unsolicited chain proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }
        this._requestedChainProof = false;

        if (this._syncing) {
            this.fire('verify-chain-proof', this._peer.peerAddress);
        }

        // Push the proof into the NanoChain.
        if (!(await this._blockchain.pushProof(msg.proof))) {
            Log.w(NanoConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - verification failed`);
            // TODO ban instead?
            this._peer.channel.close(CloseType.INVALID_CHAIN_PROOF, 'invalid chain proof');
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
                this._peer.channel.close(CloseType.RECEIVED_INVALID_BLOCK, 'received invalid block');
                break;
            }
        }
        this._orphanedBlocks = [];
    }

    /**
     * @param {Array.<InvVector>} vectors
     * @returns {void}
     * @protected
     * @override
     */
    _doRequestData(vectors) {
        /** @type {Array.<InvVector>} */
        const blocks = [];
        /** @type {Array.<InvVector>} */
        const transactions = [];
        for (const vector of vectors) {
            if (vector.type === InvVector.Type.BLOCK) {
                blocks.push(vector);
            } else {
                transactions.push(vector);
            }
        }

        // Request headers and transactions from peer.
        this._peer.channel.getHeader(blocks);
        this._peer.channel.getData(transactions);
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
     * @returns {Promise.<?Block>}
     * @protected
     * @override
     */
    _getBlock(hash, includeForks = false) {
        return this._blockchain.getBlock(hash, includeForks);
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
            this._peer.channel.close(CloseType.RECEIVED_INVALID_HEADER, 'received invalid header');
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
    _processTransaction(hash, transaction) {
        return this._mempool.pushTransaction(transaction);
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
