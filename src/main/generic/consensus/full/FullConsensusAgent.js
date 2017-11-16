class FullConsensusAgent extends BaseConsensusAgent {
    /**
     * @param {FullChain} blockchain
     * @param {Mempool} mempool
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, peer) {
        super(peer);
        /** @type {FullChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        /** @type {boolean} */
        this._syncing = false;

        // Flag indicating that have synced our blockchain with the peer's.
        /** @type {boolean} */
        this._synced = false;

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

        // Listen to consensus messages from the peer.
        peer.channel.on('get-blocks', msg => this._onGetBlocks(msg));
        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));
        peer.channel.on('get-accounts-proof', msg => this._onGetAccountsProof(msg));
        peer.channel.on('get-accounts-tree-chunk', msg => this._onGetAccountsTreeChunk(msg));
        peer.channel.on('mempool', msg => this._onMempool(msg));
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @override
     */
    relayBlock(block) {
        // Don't relay if no consensus established yet.
        if (!this._synced) return Promise.resolve();
        return super.relayBlock(block);
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

        // If we know the peer's head block, there is nothing more to be learned from this peer.
        const head = await this._blockchain.getBlock(this._peer.headHash, /*includeForks*/ true);
        if (head) {
            this._syncFinished();
            return;
        }

        // If the peer didn't send us any blocks that extended our chain, count it as a failed sync attempt.
        // This sets a maximum length for forks that the full client will accept:
        //   FullConsensusAgent.MAX_SYNC_ATTEMPTS * BaseInvectoryMessage.VECTORS_MAX_COUNT
        if (this._numBlocksExtending === 0 && ++this._failedSyncs >= FullConsensusAgent.MAX_SYNC_ATTEMPTS) {
            this._peer.channel.ban('blockchain sync failed');
            return;
        }

        // We don't know the peer's head block, request blocks from it.
        this._requestBlocks();
    }

    _syncFinished() {
        // Subscribe to all announcements from the peer.
        this._peer.channel.subscribe(Subscription.ANY);

        this._syncing = false;
        this._synced = true;

        this._numBlocksExtending = 0;
        this._numBlocksForking = 0;
        this._forkHead = null;

        this.fire('sync');
    }

    async _requestBlocks(maxInvSize) {
        // Only one getBlocks request at a time.
        if (this._timers.timeoutExists('getBlocks')) {
            Log.e(FullConsensusAgent, 'Duplicate _requestBlocks()');
            return;
        }

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        // Set timeout early to prevent re-entering the method.
        this._timers.setTimeout('getBlocks', () => {
            this._timers.clearTimeout('getBlocks');
            this._peer.channel.close('getBlocks timeout');
        }, BaseConsensusAgent.REQUEST_TIMEOUT);

        // Check if the peer is sending us a fork.
        const onFork = this._forkHead && this._numBlocksExtending === 0 && this._numBlocksForking > 0;

        /** @type {Array.<Hash>} */
        const locators = [];
        if (onFork) {
            // Only send the fork head as locator if the peer is sending us a fork.
            locators.push(await this._forkHead.hash());
        } else {
            // Request blocks starting from our hardest chain head going back to
            // the genesis block. Push top 10 hashes first, then back off exponentially.
            locators.push(this._blockchain.headHash);

            let block = this._blockchain.head;
            for (let i = Math.min(10, this._blockchain.height) - 1; i > 0; i--) {
                locators.push(block.prevHash);
                block = await this._blockchain.getBlock(block.prevHash); // eslint-disable-line no-await-in-loop
            }

            let step = 2;
            for (let i = this._blockchain.height - 10 - step; i > 0; i -= step) {
                block = await this._blockchain.getBlockAt(i); // eslint-disable-line no-await-in-loop
                locators.push(await block.hash()); // eslint-disable-line no-await-in-loop
                step *= 2;
            }

            // Push the genesis block hash.
            if (locators.length === 0 || !locators[locators.length - 1].equals(Block.GENESIS.HASH)) {
                locators.push(Block.GENESIS.HASH);
            }
        }

        // Reset block counters.
        this._numBlocksExtending = 0;
        this._numBlocksForking = 0;

        // Request blocks from peer.
        if (maxInvSize) {
            this._peer.channel.getBlocks(locators);
        } else {
            this._peer.channel.getBlocks(locators, maxInvSize);
        }
    }

    /**
     * @param {InvMessage} msg
     * @returns {Promise}
     * @protected
     * @override
     */
    _onInv(msg) {
        // Clear the getBlocks timeout.
        this._timers.clearTimeout('getBlocks');
        return super._onInv(msg);
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
     * @returns {Promise.<?Block>}
     * @protected
     * @override
     */
    _getBlock(hash, includeForks = false) {
        return this._blockchain.getBlock(hash, includeForks);
    }

    /**
     * @param {Hash} hash
     * @returns {Promise.<?Transaction>}
     * @protected
     * @override
     */
    _getTransaction(hash) {
        return Promise.resolve(this._mempool.getTransaction(hash));
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

        // Check if this block is on a fork.
        const onFork = !(await this._getBlock(hash, /*includeForks*/ false));
        if (onFork) {
            this._numBlocksForking++;
            if (this._forkHead && !(await block.isImmediateSuccessorOf(this._forkHead))) {
                // The peer is sending fork blocks, but they are not forming a chain. Drop peer.
                this._peer.channel.close('conspicuous fork');
                return;
            }
            this._forkHead = block;
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
     * @param {Block} block
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processBlock(block) {
        // TODO send reject message if we don't like the block
        const status = await this._blockchain.pushBlock(block);
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
                    if (this._forkHead && !(await block.isImmediateSuccessorOf(this._forkHead))) {
                        // The peer is sending fork blocks, but they are not forming a chain. Drop peer.
                        this._peer.channel.close('conspicuous fork');
                        break;
                    }
                    this._forkHead = block;
                }
                break;
        }
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<boolean>}
     * @protected
     * @override
     */
    _processTransaction(transaction) {
        // TODO send reject message if we don't like the transaction
        return this._mempool.pushTransaction(transaction);
    }

    /**
     * @protected
     * @override
     */
    _onAllObjectsProcessed() {
        // If all objects have been processed, request more if we're syncing the blockchain.
        if (this._syncing) {
            this.syncBlockchain();
        }
    }


    /* Request endpoints */

    /**
     * @param {GetBlocksMessage} msg
     * @return {Promise}
     * @private
     */
    async _onGetBlocks(msg) {
        Log.v(FullConsensusAgent, `[GETBLOCKS] ${msg.locators.length} block locators maxInvSize ${msg.maxInvSize} received from ${this._peer.peerAddress}`);

        // A peer has requested blocks. Check all requested block locator hashes
        // in the given order and pick the first hash that is found on our main
        // chain, ignore the rest. If none of the requested hashes is found,
        // pick the genesis block hash. Send the main chain starting from the
        // picked hash back to the peer.
        let startBlock = Block.GENESIS;
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
        const blocks = await this._blockchain.getBlocks(startBlock.height + 1,
            Math.min(msg.maxInvSize, FullConsensusAgent.GETBLOCKS_VECTORS_MAX),
            msg.direction === GetBlocksMessage.Direction.FORWARD);
        const vectors = [];
        for (const block of blocks) {
            const hash = await block.hash();
            vectors.push(new InvVector(InvVector.Type.BLOCK, hash));
        }

        // Send the vectors back to the requesting peer.
        this._peer.channel.inv(vectors);
    }

    /**
     * @param {GetChainProofMessage} msg
     * @private
     */
    async _onGetChainProof(msg) {
        const proof = await this._blockchain.getChainProof();
        this._peer.channel.chainProof(proof);
    }

    /**
     * @param {GetAccountsProofMessage} msg
     * @private
     */
    async _onGetAccountsProof(msg) {
        const proof = await this._blockchain.getAccountsProof(msg.blockHash, msg.addresses);
        if (!proof) {
            this._peer.channel.rejectAccounts();
        } else {
            this._peer.channel.accountsProof(msg.blockHash, proof);
        }
    }

    /**
     * @param {GetAccountsTreeChunkMessage} msg
     * @private
     */
    async _onGetAccountsTreeChunk(msg) {
        const chunk = await this._blockchain.getAccountsTreeChunk(msg.blockHash, msg.startPrefix);
        if (!chunk) {
            this._peer.channel.rejectAccounts();
        } else {
            this._peer.channel.accountsTreeChunk(msg.blockHash, chunk);
        }
    }

    /**
     * @param {MempoolMessage} msg
     * @return {Promise}
     * @private
     */
    async _onMempool(msg) {
        // Query mempool for transactions
        const transactions = await this._mempool.getTransactions();

        // Send transactions back to sender.
        for (const tx of transactions) {
            this._peer.channel.tx(tx);
        }
    }

    /** @type {boolean} */
    get synced() {
        return this._synced;
    }
}
/**
 * Maximum number of blockchain sync retries before closing the connection.
 * XXX If the peer is on a long fork, it will count as a failed sync attempt
 * if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getBlocks)
 * blocks.
 * @type {number}
 */
FullConsensusAgent.MAX_SYNC_ATTEMPTS = 10;
/**
 * Maximum number of inventory vectors to sent in the response for onGetBlocks.
 * @type {number}
 */
FullConsensusAgent.GETBLOCKS_VECTORS_MAX = 500;
Class.register(FullConsensusAgent);
