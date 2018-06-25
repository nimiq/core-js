class FullConsensusAgent extends BaseConsensusAgent {
    /**
     * @param {FullChain} blockchain
     * @param {Mempool} mempool
     * @param {Time} time
     * @param {Peer} peer
     * @param {InvRequestManager} invRequestManager
     * @param {Subscription} targetSubscription
     */
    constructor(blockchain, mempool, time, peer, invRequestManager, targetSubscription) {
        super(time, peer, invRequestManager, targetSubscription);
        /** @type {FullChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        /** @type {boolean} */
        this._syncing = false;

        // The number of blocks that extended our blockchain since the last requestBlocks().
        /** @type {number} */
        this._numBlocksExtending = -1;
        // The number of blocks that forked our blockchain since the last requestBlocks().
        /** @type {number} */
        this._numBlocksForking = -1;
        // The last fork block the peer has sent us.
        /** @type {Block} */
        this._forkHead = null;

        // The number of failed blockchain sync attempts.
        /** @type {number} */
        this._failedSyncs = 0;

        // The block hash that we want to learn to consider the sync complete.
        /** @type {Hash} */
        this._syncTarget = peer.headHash;

        /** @type {RateLimit} */
        this._chainProofLimit = new RateLimit(FullConsensusAgent.CHAIN_PROOF_RATE_LIMIT);
        /** @type {RateLimit} */
        this._accountsProofLimit = new RateLimit(FullConsensusAgent.ACCOUNTS_PROOF_RATE_LIMIT);
        /** @type {RateLimit} */
        this._accountsTreeChunkLimit = new RateLimit(FullConsensusAgent.ACCOUNTS_TREE_CHUNK_RATE_LIMIT);
        /** @type {RateLimit} */
        this._transactionsProofLimit = new RateLimit(FullConsensusAgent.TRANSACTION_PROOF_RATE_LIMIT);
        /** @type {RateLimit} */
        this._transactionReceiptsLimit = new RateLimit(FullConsensusAgent.TRANSACTION_RECEIPTS_RATE_LIMIT);
        /** @type {RateLimit} */
        this._blockProofLimit = new RateLimit(FullConsensusAgent.BLOCK_PROOF_RATE_LIMIT);
        /** @type {RateLimit} */
        this._getBlocksLimit = new RateLimit(FullConsensusAgent.GET_BLOCKS_RATE_LIMIT);

        // Listen to consensus messages from the peer.
        peer.channel.on('get-blocks', msg => this._onGetBlocks(msg));
        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));
        peer.channel.on('get-accounts-proof', msg => this._onGetAccountsProof(msg));
        peer.channel.on('get-accounts-tree-chunk', msg => this._onGetAccountsTreeChunk(msg));
        peer.channel.on('get-transactions-proof', msg => this._onGetTransactionsProof(msg));
        peer.channel.on('get-transaction-receipts', msg => this._onGetTransactions(msg));
        peer.channel.on('get-block-proof', msg => this._onGetBlockProof(msg));
        peer.channel.on('mempool', msg => this._onMempool(msg));
    }

    async syncBlockchain() {
        this._syncing = true;

        // We only sync with other full nodes.
        if (!Services.isFullNode(this._peer.peerAddress.services)) {
            this._syncFinished();
            return;
        }

        // Wait for all objects to arrive.
        if (!this._objectsInFlight.isEmpty()) {
            Log.v(FullConsensusAgent, `Waiting for ${this._objectsInFlight.length} objects to arrive ...`);
            return;
        }

        // Wait for all objects to be processed.
        if (!this._objectsProcessing.isEmpty()) {
            Log.v(FullConsensusAgent, `Waiting for ${this._objectsProcessing.length} objects to be processed ...`);
            return;
        }

        // If we know our sync target block, the sync process is finished.
        const head = await this._blockchain.getBlock(this._syncTarget, /*includeForks*/ true);
        if (head) {
            this._syncFinished();
            return;
        }

        // If the peer didn't send us any blocks that extended our chain, count it as a failed sync attempt.
        // This sets a maximum length for forks that the full client will accept:
        //   FullConsensusAgent.SYNC_ATTEMPTS_MAX * BaseInvectoryMessage.VECTORS_MAX_COUNT
        if (this._numBlocksExtending === 0 && ++this._failedSyncs >= FullConsensusAgent.SYNC_ATTEMPTS_MAX) {
            this._peer.channel.close(CloseType.BLOCKCHAIN_SYNC_FAILED, 'blockchain sync failed');
            return;
        }

        // We don't know the peer's head block, request blocks from it.
        this._requestBlocks().catch(Log.w.tag(FullConsensusAgent));
    }

    _syncFinished() {
        // Subscribe to all announcements from the peer.
        this._subscribeTarget();

        // Request the peer's mempool.
        // XXX Use a random delay here to prevent requests to multiple peers at once.
        const delay = FullConsensusAgent.MEMPOOL_DELAY_MIN
            + Math.random() * (FullConsensusAgent.MEMPOOL_DELAY_MAX - FullConsensusAgent.MEMPOOL_DELAY_MIN);
        setTimeout(() => this._peer.channel.mempool(), delay);

        this._syncing = false;
        this._synced = true;

        this._numBlocksExtending = 0;
        this._numBlocksForking = 0;
        this._forkHead = null;
        this._failedSyncs = 0;

        this.fire('sync');
    }

    async _requestBlocks(maxInvSize) {
        // Only one getBlocks request at a time.
        if (this._peer.channel.isExpectingMessage(Message.Type.INV)) {
            return;
        }

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        // Set timeout early to prevent re-entering the method.
        this._peer.channel.expectMessage(Message.Type.INV, () => {
            this._peer.channel.close(CloseType.GET_BLOCKS_TIMEOUT, 'getBlocks timeout');
        }, BaseConsensusAgent.REQUEST_TIMEOUT);

        // Check if the peer is sending us a fork.
        const onFork = this._forkHead && this._numBlocksExtending === 0 && this._numBlocksForking > 0;

        /** @type {Array.<Hash>} */
        let locators;
        if (onFork) {
            // Only send the fork head as locator if the peer is sending us a fork.
            locators = [this._forkHead.hash()];
        } else {
            locators = await this._blockchain.getBlockLocators();
        }

        // Reset block counters.
        this._numBlocksExtending = 0;
        this._numBlocksForking = 0;

        // Request blocks from peer.
        this._peer.channel.getBlocks(locators, maxInvSize);
    }

    /**
     * @param {InvVector} vector
     * @returns {boolean}
     * @protected
     * @override
     */
    _shouldRequestData(vector) {
        // Ignore block announcements from nano clients as they will ignore our getData requests anyways (they only know headers).
        return !(Services.isNanoNode(this._peer.peerAddress.services) && vector.type === InvVector.Type.BLOCK);
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
     * @param {boolean} [includeBody]
     * @returns {Promise.<?Block>}
     * @protected
     * @override
     */
    _getBlock(hash, includeForks = false, includeBody = false) {
        return this._blockchain.getBlock(hash, includeForks, includeBody);
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
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
     * @param {Block} block
     * @returns {void}
     * @protected
     * @override
     */
    async _onKnownBlockAnnounced(hash, block) {
        if (!this._syncing) return;

        this._numBlocksForking++;
        this._forkHead = block;
    }

    /**
     * @returns {void}
     * @protected
     * @override
     */
    _onNoUnknownObjects() {
        // The peer does not have any new inv vectors for us.
        if (this._syncing) {
            this.syncBlockchain().catch(Log.w.tag(FullConsensusAgent));
        }
    }

    /**
     * @protected
     * @override
     */
    _onAllObjectsReceived() {
        // If all objects have been received, request more if we're syncing the blockchain.
        if (this._syncing) {
            this.syncBlockchain().catch(Log.w.tag(FullConsensusAgent));
        }
    }

    /**
     * @param {HeaderMessage} msg
     * @return {Promise.<void>}
     * @protected
     * @override
     */
    _onHeader(msg) {
        // Ignore header messages.
        Log.w(FullConsensusAgent, `Unsolicited header message received from ${this._peer.peerAddress}, discarding`);
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processBlock(hash, block) {
        // TODO send reject message if we don't like the block
        const status = await this._blockchain.pushBlock(block);
        switch (status) {
            case FullChain.ERR_INVALID:
                this._peer.channel.close(CloseType.RECEIVED_INVALID_BLOCK, 'received invalid block');
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

            case FullChain.ERR_ORPHAN:
                this._onOrphanBlock(hash, block);
                break;

            case FullChain.OK_KNOWN:
                Log.v(FullConsensusAgent, `Received known block ${hash} (height=${block.height}, prevHash=${block.prevHash}) from ${this._peer.peerAddress}`);
                break;
        }
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @protected
     */
    _onOrphanBlock(hash, block) {
        // Ignore orphan blocks if we're not synced yet. This shouldn't happen.
        if (!this._synced) {
            Log.w(FullConsensusAgent, `Received orphan block ${hash} (height=${block.height}, prevHash=${block.prevHash}) while syncing`);
            return;
        }

        // The peer has announced an orphaned block after the initial sync. We're probably out of sync.
        Log.d(FullConsensusAgent, `Received orphan block ${hash} (height=${block.height}, prevHash=${block.prevHash}) from ${this._peer.peerAddress}`);

        // Disable announcements from the peer once.
        if (!this._timers.timeoutExists('outOfSync')) {
            this._subscribe(Subscription.NONE);
        }

        // Set the orphaned block as the new sync target.
        this._syncTarget = hash;

        // Wait a short time for:
        // - our (un-)subscribe message to be sent
        // - potentially more orphaned blocks to arrive
        this._timers.resetTimeout('outOfSync', () => this._outOfSync(), FullConsensusAgent.RESYNC_THROTTLE);
    }

    /**
     * @private
     */
    _outOfSync() {
        this._timers.clearTimeout('outOfSync');

        this._synced = false;

        this.fire('out-of-sync');
    }

    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @returns {Promise.<boolean>}
     * @protected
     * @override
     */
    async _processTransaction(hash, transaction) {
        const result = await this._mempool.pushTransaction(transaction);
        switch (result) {
            case Mempool.ReturnCode.ACCEPTED:
                return true;
            case Mempool.ReturnCode.KNOWN:
                return false;
            case Mempool.ReturnCode.FEE_TOO_LOW:
                this.peer.channel.reject(Message.Type.TX, RejectMessage.Code.REJECT_INSUFFICIENT_FEE,
                    'Sender has too many free transactions', transaction.hash().serialize());
                return false;
            case Mempool.ReturnCode.INVALID:
                this.peer.channel.reject(Message.Type.TX, RejectMessage.Code.REJECT_INVALID, 'Invalid transaction',
                    transaction.hash().serialize());
                return false;
            default:
                return false;
        }
    }

    /**
     * @protected
     * @override
     */
    _onAllObjectsProcessed() {
        // If all objects have been processed, request more if we're syncing the blockchain.
        if (this._syncing) {
            this.syncBlockchain().catch(Log.w.tag(FullConsensusAgent));
        }
    }


    /* Request endpoints */

    /**
     * @param {GetBlocksMessage} msg
     * @return {Promise}
     * @private
     */
    async _onGetBlocks(msg) {
        if (!this._getBlocksLimit.note()) {
            Log.w(FullConsensusAgent, 'Rejecting GetBlocks message - rate-limit exceeded');
            return;
        }
        Log.v(FullConsensusAgent, `[GETBLOCKS] ${msg.locators.length} block locators maxInvSize ${msg.maxInvSize} received from ${this._peer.peerAddress}`);

        // A peer has requested blocks. Check all requested block locator hashes
        // in the given order and pick the first hash that is found on our main
        // chain, ignore the rest. If none of the requested hashes is found,
        // pick the genesis block hash. Send the main chain starting from the
        // picked hash back to the peer.
        let startBlock = GenesisConfig.GENESIS_BLOCK;
        for (const locator of msg.locators) {
            const block = await this._blockchain.getBlock(locator);
            if (block) {
                // We found a block, ignore remaining block locator hashes.
                startBlock = block;
                break;
            }
        }

        // Collect up to GETBLOCKS_VECTORS_MAX inventory vectors for the blocks starting right
        // after the identified block on the main chain.
        const blocks = await this._blockchain.getBlocks(startBlock.hash(),
            Math.min(msg.maxInvSize, FullConsensusAgent.GETBLOCKS_VECTORS_MAX),
            msg.direction === GetBlocksMessage.Direction.FORWARD);
        const vectors = [];
        for (const block of blocks) {
            vectors.push(InvVector.fromBlock(block));
        }

        // Send the vectors back to the requesting peer.
        this._peer.channel.inv(vectors);
    }

    /**
     * @param {GetChainProofMessage} msg
     * @private
     */
    async _onGetChainProof(msg) {
        if (!this._chainProofLimit.note()) {
            Log.w(FullConsensusAgent, 'Rejecting GetChainProof message - rate-limit exceeded');
            this._peer.channel.close(CloseType.RATE_LIMIT_EXCEEDED, 'rate-limit exceeded');
            return;
        }
        const proof = await this._blockchain.getChainProof();
        this._peer.channel.chainProof(proof);
    }

    /**
     * @param {GetBlockProofMessage} msg
     * @private
     */
    async _onGetBlockProof(msg) {
        if (!this._blockProofLimit.note()) {
            Log.w(FullConsensusAgent, 'Rejecting GetBlockProof message - rate-limit exceeded');
            this._peer.channel.blockProof(null);
            return;
        }
        const blockToProve = await this._blockchain.getBlock(msg.blockHashToProve);
        const knownBlock = await this._blockchain.getBlock(msg.knownBlockHash);
        if (!blockToProve || !knownBlock) {
            this._peer.channel.blockProof();
            return;
        }

        const proof = await this._blockchain.getBlockProof(blockToProve, knownBlock);
        this._peer.channel.blockProof(proof);
    }

    /**
     * @param {GetAccountsProofMessage} msg
     * @private
     */
    async _onGetAccountsProof(msg) {
        if (!this._accountsProofLimit.note()) {
            Log.w(FullConsensusAgent, 'Rejecting GetAccountsProof message - rate-limit exceeded');
            this._peer.channel.accountsProof(msg.blockHash, null);
            return;
        }
        const proof = await this._blockchain.getAccountsProof(msg.blockHash, msg.addresses);
        this._peer.channel.accountsProof(msg.blockHash, proof);
    }

    /**
     * @param {GetTransactionsProofMessage} msg
     * @private
     */
    async _onGetTransactionsProof(msg) {
        if (!this._transactionsProofLimit.note()) {
            Log.w(FullConsensusAgent, 'Rejecting GetTransactionsProof message - rate-limit exceeded');
            this._peer.channel.transactionsProof(msg.blockHash, null);
            return;
        }
        const proof = await this._blockchain.getTransactionsProof(msg.blockHash, msg.addresses);
        this._peer.channel.transactionsProof(msg.blockHash, proof);
    }

    /**
     * @param {GetAccountsTreeChunkMessage} msg
     * @private
     */
    async _onGetAccountsTreeChunk(msg) {
        if (!this._accountsTreeChunkLimit.note()) {
            Log.w(FullConsensusAgent, 'Rejecting GetAccountsTreeChunk message - rate-limit exceeded');
            this._peer.channel.accountsTreeChunk(msg.blockHash, null);
            return;
        }
        const chunk = await this._blockchain.getAccountsTreeChunk(msg.blockHash, msg.startPrefix);
        this._peer.channel.accountsTreeChunk(msg.blockHash, chunk);
    }

    /**
     * @param {GetTransactionReceiptsMessage} msg
     * @private
     */
    async _onGetTransactions(msg) {
        if (!this._transactionReceiptsLimit.note()) {
            Log.w(FullConsensusAgent, 'Rejecting GetTransactionReceipts message - rate-limit exceeded');
            this._peer.channel.transactionReceipts(null);
            return;
        }

        const receipts = await this._blockchain.getTransactionReceiptsByAddress(msg.address, TransactionReceiptsMessage.RECEIPTS_MAX_COUNT);
        this._peer.channel.transactionReceipts(receipts);
    }

    /**
     * @param {MempoolMessage} msg
     * @return {Promise}
     * @private
     */
    async _onMempool(msg) {
        // Query mempool for transactions
        let transactions = [];
        switch (this._remoteSubscription.type) {
            case Subscription.Type.ADDRESSES:
                transactions = this._mempool.getTransactionsByAddresses(this._remoteSubscription.addresses, FullConsensusAgent.MEMPOOL_ENTRIES_MAX);
                break;
            case Subscription.Type.MIN_FEE:
                transactions = new LimitIterable(this._mempool.transactionGenerator(/*maxSize*/ undefined, this._remoteSubscription.minFeePerByte), FullConsensusAgent.MEMPOOL_ENTRIES_MAX);
                break;
            case Subscription.Type.ANY:
                transactions = new LimitIterable(this._mempool.transactionGenerator(), FullConsensusAgent.MEMPOOL_ENTRIES_MAX);
                break;
        }

        // Send an InvVector for each transaction in the mempool.
        // Split into multiple Inv messages if the mempool is large.
        let vectors = [];
        for (const tx of transactions) {
            vectors.push(InvVector.fromTransaction(tx));

            if (vectors.length >= BaseInventoryMessage.VECTORS_MAX_COUNT) {
                this._peer.channel.inv(vectors);
                vectors = [];
                await new Promise((resolve) => setTimeout(resolve, FullConsensusAgent.MEMPOOL_THROTTLE));
            }
        }

        if (vectors.length > 0) {
            this._peer.channel.inv(vectors);
        }
    }

    /** @type {boolean} */
    get syncing() {
        return this._syncing;
    }
}
/**
 * Maximum number of blockchain sync retries before closing the connection.
 * XXX If the peer is on a long fork, it will count as a failed sync attempt
 * if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getBlocks)
 * blocks.
 * @type {number}
 */
FullConsensusAgent.SYNC_ATTEMPTS_MAX = 25;
/**
 * Maximum number of inventory vectors to sent in the response for onGetBlocks.
 * @type {number}
 */
FullConsensusAgent.GETBLOCKS_VECTORS_MAX = 500;
/**
 * Time {ms} to wait before triggering a blockchain re-sync with the peer.
 * @type {number}
 */
FullConsensusAgent.RESYNC_THROTTLE = 1000 * 3; // 3 seconds
/**
 * Minimum time {ms} to wait before triggering the initial mempool request.
 * @type {number}
 */
FullConsensusAgent.MEMPOOL_DELAY_MIN = 1000 * 2; // 2 seconds
/**
 * Maximum time {ms} to wait before triggering the initial mempool request.
 * @type {number}
 */
FullConsensusAgent.MEMPOOL_DELAY_MAX = 1000 * 20; // 20 seconds
/**
 * Time {ms} to wait between sending full inv vectors of transactions during Mempool request
 * @type {number}
 */
FullConsensusAgent.MEMPOOL_THROTTLE = 1000;
/**
 * Number of transaction vectors to send
 * @type {number}
 */
FullConsensusAgent.MEMPOOL_ENTRIES_MAX = 10000;
FullConsensusAgent.CHAIN_PROOF_RATE_LIMIT = 3; // per minute
FullConsensusAgent.ACCOUNTS_PROOF_RATE_LIMIT = 60; // per minute
FullConsensusAgent.ACCOUNTS_TREE_CHUNK_RATE_LIMIT = 120; // per minute
FullConsensusAgent.TRANSACTION_PROOF_RATE_LIMIT = 60; // per minute
FullConsensusAgent.TRANSACTION_RECEIPTS_RATE_LIMIT = 30; // per minute
FullConsensusAgent.BLOCK_PROOF_RATE_LIMIT = 60; // per minute
FullConsensusAgent.GET_BLOCKS_RATE_LIMIT = 30; // per minute
Class.register(FullConsensusAgent);
