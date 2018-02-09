class LightConsensusAgent extends FullConsensusAgent {
    /**
     * @param {LightChain} blockchain
     * @param {Mempool} mempool
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, peer) {
        super(blockchain, mempool, peer);
        /** @type {LightChain} */
        this._blockchain = blockchain;
        /** @type {PartialLightChain} */
        this._partialChain = null;

        /** @type {boolean} */
        this._syncing = false;

        // Flag indicating whether we do a full catchup or request a proof.
        /** @type {boolean} */
        this._catchup = false;

        // Flag indicating whether we believe to be on the main chain of the client.
        /** @type {boolean} */
        this._onMainChain = false;

        /** @type {Array.<Block>} */
        this._orphanedBlocks = [];

        /** @type {boolean} */
        this._busy = false;

        // Helper object to keep track of the accounts we're requesting from the peer.
        this._accountsRequest = null;

        // Flag to track chain proof requests.
        this._requestedChainProof = false;

        // Listen to consensus messages from the peer.
        peer.channel.on('chain-proof', msg => this._onChainProof(msg));
        peer.channel.on('accounts-tree-chunk', msg => this._onAccountsTreeChunk(msg));
    }

    /**
     * @returns {Promise.<void>}
     * @override
     */
    async syncBlockchain() {
        // We only sync with other full nodes.
        if (Services.isNanoNode(this._peer.peerAddress.services)) {
            this._syncFinished();
            return;
        }

        // Wait for all objects to arrive.
        if (!this._objectsInFlight.isEmpty()) {
            Log.v(LightConsensusAgent, `Waiting for ${this._objectsInFlight.length} objects to arrive ...`);
            return;
        }

        // Wait for all objects to be processed.
        if (!this._objectsProcessing.isEmpty()) {
            Log.v(LightConsensusAgent, `Waiting for ${this._objectsProcessing.length} objects to be processed ...`);
            return;
        }

        // Ban peer if the sync failed more often than allowed.
        if (this._failedSyncs >= LightConsensusAgent.SYNC_ATTEMPTS_MAX) {
            this._peer.channel.ban('blockchain sync failed');
            if (this._partialChain) {
                await this._partialChain.abort();
                this._partialChain = null;
            }
            return;
        }

        // Check if we know head block.
        const block = await this._blockchain.getBlock(this._syncTarget);

        /*
         * Three cases:
         * 1) We know block and are not yet syncing: All is done.
         * 2) We don't know the block and are not yet syncing: Start syncing.
         *    and determine sync mode (full catchup or not).
         * 3) We are syncing. Behave differently based on sync mode.
         *    Note that we can switch from catchup to proof if we notice that
         *    we're on a fork and get an INV vector starting from the genesis block.
         */

        // Case 1: We're up to date.
        if (block && !this._syncing) {
            this._syncFinished();
            return;
        }

        // Case 2: Check header.
        if (!block && !this._syncing) {
            this._syncing = true;
            this._onMainChain = false;

            let header;
            try {
                header = await this.getHeader(this._syncTarget);
            } catch(err) {
                this._peer.channel.close('Did not get requested header');
                return;
            }

            // Check how to sync based on heuristic:
            this._catchup = header.height - this._blockchain.height <= Policy.NUM_BLOCKS_VERIFICATION;
            Log.d(LightConsensusAgent, `Start syncing, catchup mode: ${this._catchup}`);
        }

        // Case 3: We are are syncing.
        if (this._syncing && !this._busy) {
            if (this._catchup) {
                await FullConsensusAgent.prototype.syncBlockchain.call(this);
            } else {
                // Initialize partial chain on first call.
                if (!this._partialChain) {
                    await this._initChainProofSync();
                }

                switch (this._partialChain.state) {
                    case PartialLightChain.State.PROVE_CHAIN:
                        this._requestChainProof();
                        this.fire('sync-chain-proof', this._peer.peerAddress);
                        break;
                    case PartialLightChain.State.PROVE_ACCOUNTS_TREE:
                        this._requestAccountsTree();
                        this.fire('sync-accounts-tree', this._peer.peerAddress);
                        break;
                    case PartialLightChain.State.PROVE_BLOCKS:
                        this._requestProofBlocks().catch(Log.w.tag(LightConsensusAgent));
                        this.fire('verify-accounts-tree', this._peer.peerAddress);
                        break;
                    case PartialLightChain.State.COMPLETE:
                        // Commit state on success.
                        this.fire('sync-finalize', this._peer.peerAddress);
                        this._busy = true;
                        await this._partialChain.commit();
                        await this._applyOrphanedBlocks();
                        this._syncFinished();
                        break;
                    case PartialLightChain.State.ABORTED:
                        this._peer.channel.close('aborted sync');
                        break;
                }
            }
        }
    }

    /**
     * @returns {Promise.<void>}
     * @private
     */
    async _initChainProofSync() {
        // Subscribe to all announcements from the peer.
        this._peer.channel.subscribe(Subscription.ANY);

        this._syncing = true;
        this._synced = false;
        this._catchup = false;
        this._onMainChain = true;

        if (this._partialChain) {
            await this._partialChain.abort();
        }

        this._partialChain = await this._blockchain.partialChain();
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        if (this._partialChain) {
            this._partialChain = null;
        }

        this._busy = false;
        super._syncFinished();
    }

    /**
     * @returns {Promise.<void>}
     * @private
     */
    async _applyOrphanedBlocks() {
        for (const block of this._orphanedBlocks) {
            const status = await this._blockchain.pushBlock(block);
            if (status === LightChain.ERR_INVALID) {
                this._peer.channel.ban('received invalid block');
                break;
            }
        }
        this._orphanedBlocks = [];
    }

    // Syncing stages.
    // Stage 1: Chain proof.
    /**
     * @returns {void}
     * @private
     */
    _requestChainProof() {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_CHAIN);
        Assert.that(!this._requestedChainProof);
        this._busy = true;

        // Request ChainProof from peer.
        this._peer.channel.getChainProof();
        this._requestedChainProof = true;

        // Drop the peer if it doesn't send the chain proof within the timeout.
        // TODO should we ban here instead?
        this._peer.channel.expectMessage(Message.Type.CHAIN_PROOF, () => {
            this._peer.channel.close('getChainProof timeout');
        }, LightConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT, LightConsensusAgent.CHAINPROOF_CHUNK_TIMEOUT);
    }

    /**
     * @param {ChainProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onChainProof(msg) {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_CHAIN);
        Log.d(LightConsensusAgent, `[CHAIN-PROOF] Received from ${this._peer.peerAddress}: ${msg.proof}`);

        // Check if we have requested an interlink chain, reject unsolicited ones.
        if (!this._requestedChainProof) {
            Log.w(LightConsensusAgent, `Unsolicited chain proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }
        this._requestedChainProof = false;

        if (this._syncing) {
            this.fire('verify-chain-proof', this._peer.peerAddress);
        }

        // Push the proof into the LightChain.
        if (!(await this._partialChain.pushProof(msg.proof))) {
            Log.w(LightConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - verification failed`);
            // TODO ban instead?
            this._peer.channel.close('invalid chain proof');
            return;
        }

        // TODO add all blocks from the chain proof to knownObjects.
        this._busy = false;
        this.syncBlockchain().catch(Log.w.tag(LightConsensusAgent));
    }

    // Stage 2: Request AccountsTree.
    /**
     * @private
     */
    _requestAccountsTree() {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_ACCOUNTS_TREE);
        Assert.that(!this._accountsRequest);
        this._busy = true;

        const startPrefix = this._partialChain.getMissingAccountsPrefix();
        const headHash = this._partialChain.headHash;
        Log.d(LightConsensusAgent, `Requesting AccountsTreeChunk starting at ${startPrefix} from ${this._peer.peerAddress}`);

        this._accountsRequest = {
            startPrefix: startPrefix,
            blockHash: headHash
        };

        // Request AccountsProof from peer.
        this._peer.channel.getAccountsTreeChunk(headHash, startPrefix);

        // Drop the peer if it doesn't send the accounts proof within the timeout.
        this._peer.channel.expectMessage(Message.Type.ACCOUNTS_TREE_CHUNK, () => {
            this._peer.channel.close('getAccountsTreeChunk timeout');
        }, LightConsensusAgent.ACCOUNTS_TREE_CHUNK_REQUEST_TIMEOUT);
    }

    /**
     * @param {AccountsTreeChunkMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onAccountsTreeChunk(msg) {
        Log.d(LightConsensusAgent, `[ACCOUNTS-TREE-CHUNK] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.chunk}`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(LightConsensusAgent, `Unsolicited accounts tree chunk received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_ACCOUNTS_TREE);

        const startPrefix = this._accountsRequest.startPrefix;
        const blockHash = this._accountsRequest.blockHash;

        // Reset accountsRequest.
        this._accountsRequest = null;

        if (!msg.hasChunk()) {
            // Restart syncing.
            await this._partialChain.abort();
            this._partialChain = null;
            this._busy = false;
            this._failedSyncs++;
            return;
        }

        // Check that we know the reference block.
        if (!blockHash.equals(msg.blockHash) || msg.chunk.head.prefix <= startPrefix) {
            Log.w(LightConsensusAgent, `Received AccountsTreeChunk for block != head or wrong start prefix from ${this._peer.peerAddress}`);
            this._peer.channel.close('Invalid AccountsTreeChunk');
            return;
        }

        // Verify the proof.
        const chunk = msg.chunk;
        if (!chunk.verify()) {
            Log.w(LightConsensusAgent, `Invalid AccountsTreeChunk received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('Invalid AccountsTreeChunk');
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = chunk.root();
        const block = await this._partialChain.getBlock(blockHash);
        if (!block.accountsHash.equals(rootHash)) {
            Log.w(LightConsensusAgent, `Invalid AccountsTreeChunk (root hash) received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('AccountsTreeChunk root hash mismatch');
            return;
        }

        // Return the retrieved accounts.
        const result = await this._partialChain.pushAccountsTreeChunk(chunk);

        // Something went wrong!
        if (result < 0) {
            // TODO maybe ban?
            Log.e(`AccountsTree sync failed with error code ${result} from ${this._peer.peerAddress}`);
            this._peer.channel.close('AccountsTreeChunk root hash mismatch');
        }

        this._busy = false;
        this.syncBlockchain().catch(Log.w.tag(LightConsensusAgent));
    }

    // Stage 3: Request proof blocks.
    /**
     * @private
     */
    _requestProofBlocks() {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_BLOCKS);

        // If nothing happend since the last request, increase failed syncs.
        if (this._lastChainHeight === this._partialChain.proofHeadHeight) {
            this._failedSyncs++;
        }
        this._lastChainHeight = this._partialChain.proofHeadHeight;

        // XXX Only one getBlocks request at a time.
        if (this._peer.channel.isExpectingMessage(Message.Type.INV)) {
            Log.e(LightConsensusAgent, 'Duplicate _requestProofBlocks()');
            return;
        }

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        this._peer.channel.expectMessage(Message.Type.INV, () => {
            this._peer.channel.close('getBlocks timeout');
        }, BaseConsensusAgent.REQUEST_TIMEOUT);

        // Request blocks from peer.
        this._peer.channel.getBlocks(this._partialChain.getBlockLocators(), this._partialChain.numBlocksNeeded(), false);
    }

    // Block processing.
    /**
     * @returns {Promise.<void>}
     * @private
     */
    _requestBlocks() {
        // If we are syncing and not yet sure whether our blocks are on the main chain, just sync one block for now.
        if (this._syncing && !this._onMainChain) {
            return super._requestBlocks(1);
        }
        return super._requestBlocks();
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processBlock(hash, block) {
        // If we find that we are on a fork far away from our chain, resync.
        if (block.height < this._chain.height - Policy.NUM_BLOCKS_VERIFICATION
            && (!this._partialChain || this._partialChain.state !== PartialLightChain.State.PROVE_BLOCKS)) {
            this._onMainChain = false;
            await this._initChainProofSync();
            this.syncBlockchain().catch(Log.w.tag(LightConsensusAgent));
            return;
        } else {
            this._onMainChain = true;
        }

        // Put block into blockchain.
        const status = await this._chain.pushBlock(block);

        switch (status) {
            case FullChain.ERR_INVALID:
                this._peer.channel.ban('received invalid block');
                break;

            case FullChain.OK_EXTENDED:
            case FullChain.OK_REBRANCHED:
                if (this._syncing) this._numBlocksExtending++;
                break;

            case FullChain.OK_FORKED:
                if (this._syncing) {
                    this._numBlocksForking++;
                    this._forkHead = block;
                }
                break;

            case LightChain.ERR_ORPHAN:
                this._onOrphanBlock(hash, block);
                break;
        }
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @returns {void}
     * @protected
     * @override
     */
    async _onKnownBlockAnnounced(hash, block) {
        if (this._syncing && this._catchup) {
            // If we find that we are on a fork far away from our chain, resync.
            if (block.height < this._chain.height - Policy.NUM_BLOCKS_VERIFICATION
                && (!this._partialChain || this._partialChain.state !== PartialLightChain.State.PROVE_BLOCKS)) {
                this._onMainChain = false;
                await this._initChainProofSync();
                this.syncBlockchain().catch(e => Log.e(LightConsensusAgent, e));
                return;
            } else {
                this._onMainChain = true;
            }

            FullConsensusAgent.prototype._onKnownBlockAnnounced.call(this, hash, block);
        }
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @private
     * @override
     */
    _onOrphanBlock(hash, block) {
        if (this._syncing && !this._catchup) {
            this._orphanedBlocks.push(block);
        } else {
            super._onOrphanBlock(hash, block);
        }
    }

    // Header processing.
    /**
     * @param {Hash} hash
     * @return {Promise.<BlockHeader>}
     */
    getHeader(hash) {
        Assert.that(!this._headerRequest);

        return new Promise((resolve, reject) => {
            const vector = new InvVector(InvVector.Type.BLOCK, hash);
            this._headerRequest = {
                hash: hash,
                resolve: resolve,
                reject: reject
            };

            this._peer.channel.getHeader([vector]);

            // Drop the peer if it doesn't send the accounts proof within the timeout.
            this._peer.channel.expectMessage(Message.Type.HEADER, () => {
                this._headerRequest = null;
                this._peer.channel.close('getHeader timeout');
                reject(new Error('timeout')); // TODO error handling
            }, BaseConsensusAgent.REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {HeaderMessage} msg
     * @return {void}
     * @protected
     * @override
     */
    _onHeader(msg) {
        const header = msg.header;
        const hash = header.hash();

        // Check if we have requested this block.
        if (!this._headerRequest) {
            Log.w(NanoConsensusAgent, `Unsolicited header ${hash} received from ${this._peer.peerAddress}, discarding`);
            // TODO What should happen here? ban? drop connection?
            return;
        }

        const requestedHash = this._headerRequest.hash;
        const resolve = this._headerRequest.resolve;
        const reject = this._headerRequest.reject;

        // Check that it is the correct hash.
        if (!requestedHash.equals(hash)) {
            Log.w(LightConsensusAgent, `Received wrong header from ${this._peer.peerAddress}`);
            this._peer.channel.close('Received wrong header');
            reject(new Error('Received wrong header'));
            return;
        }

        resolve(header);
    }

    /**
     * @returns {void}
     * @protected
     * @override
     */
    _onClose() {
        if (this._partialChain) {
            this._partialChain.abort().catch(Log.w.tag(LightConsensusAgent));
        }

        super._onClose();
    }

    /** @type {LightChain} */
    get _chain() {
        if (this._syncing && !this._catchup && this._partialChain) {
            return this._partialChain;
        }
        return this._blockchain;
    }
}
/**
 * Maximum time (ms) to wait for chain-proof after sending out get-chain-proof before dropping the peer.
 * @type {number}
 */
LightConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT = 1000 * 45;
/**
 * Maximum time (ms) to wait for between chain-proof chunks before dropping the peer.
 * @type {number}
 */
LightConsensusAgent.CHAINPROOF_CHUNK_TIMEOUT = 1000 * 10;
/**
 * Maximum time (ms) to wait for accounts-tree-chunk after sending out get-accounts-tree-chunk before dropping the peer.
 * @type {number}
 */
LightConsensusAgent.ACCOUNTS_TREE_CHUNK_REQUEST_TIMEOUT = 1000 * 8;
/**
 * Maximum number of blockchain sync retries before closing the connection.
 * XXX If the peer is on a long fork, it will count as a failed sync attempt
 * if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getBlocks)
 * blocks.
 * @type {number}
 */
LightConsensusAgent.SYNC_ATTEMPTS_MAX = 5;
/**
 * Maximum number of inventory vectors to sent in the response for onGetBlocks.
 * @type {number}
 */
LightConsensusAgent.GETBLOCKS_VECTORS_MAX = 500;
Class.register(LightConsensusAgent);
