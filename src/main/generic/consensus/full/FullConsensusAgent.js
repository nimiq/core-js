class FullConsensusAgent extends Observable {
    /**
     * @param {FullChain} blockchain
     * @param {Mempool} mempool
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, peer) {
        super();
        /** @type {FullChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Peer} */
        this._peer = peer;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        /** @type {boolean} */
        this._syncing = false;

        // Flag indicating that have synced our blockchain with the peer's.
        /** @type {boolean} */
        this._synced = false;

        // The height of our blockchain when we last attempted to sync the chain.
        /** @type {number} */
        this._lastChainHeight = 0;

        // The number of failed blockchain sync attempts.
        /** @type {number} */
        this._failedSyncs = 0;

        // Set of all objects (InvVectors) that we think the remote peer knows.
        /** @type {HashSet.<InvVector>} */
        this._knownObjects = new HashSet();

        // InvVectors we want to request via getData are collected here and
        // periodically requested.
        /** @type {IndexedArray} */
        this._objectsToRequest = new IndexedArray([], true);

        // Objects that are currently being requested from the peer.
        this._objectsInFlight = null;

        // Helper object to keep track of timeouts & intervals.
        /** @type {Timers} */
        this._timers = new Timers();

        // Listen to consensus messages from the peer.
        peer.channel.on('inv', msg => this._onInv(msg));
        peer.channel.on('get-data', msg => this._onGetData(msg));
        peer.channel.on('get-header', msg => this._onGetHeader(msg));
        peer.channel.on('not-found', msg => this._onNotFound(msg));
        peer.channel.on('block', msg => this._onBlock(msg));
        peer.channel.on('tx', msg => this._onTx(msg));
        peer.channel.on('get-blocks', msg => this._onGetBlocks(msg));
        peer.channel.on('mempool', msg => this._onMempool(msg));

        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));
        peer.channel.on('get-accounts-proof', msg => this._onGetAccountsProof(msg));
        peer.channel.on('get-accounts-tree-chunk', msg => this._onGetAccountsTreeChunk(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());

        // Wait for the blockchain to processes queued blocks before requesting more.
        this._blockchain.on('ready', () => {
            if (this._syncing) this.syncBlockchain();
        });
    }

    /**
     * @param {Block} block
     * @return {Promise}
     */
    async relayBlock(block) {
        // Don't relay if no consensus established yet.
        if (!this._synced) {
            return;
        }

        // Create InvVector.
        const hash = await block.hash();
        const vector = new InvVector(InvVector.Type.BLOCK, hash);

        // Don't relay block to this peer if it already knows it.
        if (this._knownObjects.contains(vector)) {
            return;
        }

        // Relay block to peer.
        this._peer.channel.inv([vector]);

        // Assume that the peer knows this block now.
        this._knownObjects.add(vector);
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise}
     */
    async relayTransaction(transaction) {
        // TODO Don't relay if no consensus established yet ???

        // Create InvVector.
        const hash = await transaction.hash();
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);

        // Don't relay transaction to this peer if it already knows it.
        if (this._knownObjects.contains(vector)) {
            return;
        }

        // Relay transaction to peer.
        this._peer.channel.inv([vector]);

        // Assume that the peer knows this transaction now.
        this._knownObjects.add(vector);
    }

    async syncBlockchain() {
        this._syncing = true;

        // If the blockchain is still busy processing blocks, wait for it to catch up.
        if (this._blockchain.busy) {
            Log.v(FullConsensusAgent, 'Blockchain busy, waiting ...');
            return;
        }

        // We only sync with other full nodes.
        if (!Services.isFullNode(this._peer.peerAddress.services)) {
            this._syncFinished();
            return;
        }

        // If we know the peer's head block, there is nothing more to be learned from this peer.
        const head = await this._blockchain.getBlock(this._peer.headHash, /*includeForks*/ true);
        if (head) {
            this._syncFinished();
            return;
        }

        // If we already requested blocks from the peer but it didn't give us any
        // good ones, retry or drop the peer.
        if (this._lastChainHeight === this._blockchain.height) {
            this._failedSyncs++;
            if (this._failedSyncs < FullConsensusAgent.MAX_SYNC_ATTEMPTS) {
                this._requestBlocks();
            } else {
                this._peer.channel.ban('blockchain sync failed');
            }
            return;
        }

        // We don't know the peer's head block, request blocks from it.
        this._lastChainHeight = this._blockchain.height;
        this._requestBlocks();
    }

    _syncFinished() {
        this._syncing = false;
        this._synced = true;
        this.fire('sync');
    }

    async _requestBlocks() {
        // XXX Only one getBlocks request at a time.
        if (this._timers.timeoutExists('getBlocks')) {
            Log.e(FullConsensusAgent, 'Duplicate _requestBlocks()');
            return;
        }

        // Request blocks starting from our hardest chain head going back to
        // the genesis block. Push top 10 hashes first, then back off exponentially.
        /** @type {Array.<Hash>} */
        const locators = [this._blockchain.headHash];
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

        // Request blocks from peer.
        this._peer.channel.getBlocks(locators);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getBlocks', () => {
            this._timers.clearTimeout('getBlocks');
            this._peer.channel.close('getBlocks timeout');
        }, FullConsensusAgent.REQUEST_TIMEOUT);
    }

    /**
     * @param {InvMessage} msg
     * @return {Promise}
     * @private
     */
    async _onInv(msg) {
        // Clear the getBlocks timeout.
        this._timers.clearTimeout('getBlocks');

        // Keep track of the objects the peer knows.
        for (const vector of msg.vectors) {
            this._knownObjects.add(vector);
        }

        // Check which of the advertised objects we know
        // Request unknown objects, ignore known ones.
        const unknownObjects = [];
        for (const vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._blockchain.getBlock(vector.hash, /*includeForks*/ true); // eslint-disable-line no-await-in-loop
                    if (!block) {
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION: {
                    const tx = await this._mempool.getTransaction(vector.hash); // eslint-disable-line no-await-in-loop
                    if (!tx) {
                        unknownObjects.push(vector);
                    }
                    break;
                }
                default:
                    throw `Invalid inventory type: ${vector.type}`;
            }
        }

        Log.v(FullConsensusAgent, `[INV] ${msg.vectors.length} vectors (${unknownObjects.length} new) received from ${this._peer.peerAddress}`);

        if (unknownObjects.length > 0) {
            // Store unknown vectors in objectsToRequest array.
            for (const obj of unknownObjects) {
                this._objectsToRequest.push(obj);
            }

            // Clear the request throttle timeout.
            this._timers.clearTimeout('inv');

            // If there are enough objects queued up, send out a getData request.
            if (this._objectsToRequest.length >= FullConsensusAgent.REQUEST_THRESHOLD) {
                this._requestData();
            }
            // Otherwise, wait a short time for more inv messages to arrive, then request.
            else {
                this._timers.setTimeout('inv', () => this._requestData(), FullConsensusAgent.REQUEST_THROTTLE);
            }
        } else {
            // XXX The peer is weird. Give him another chance.
            this._noMoreData();
        }
    }

    _requestData() {
        // Only one request at a time.
        if (this._objectsInFlight) return;

        // Don't do anything if there are no objects queued to request.
        if (this._objectsToRequest.isEmpty()) return;

        // Mark the requested objects as in-flight.
        this._objectsInFlight = this._objectsToRequest;

        // Request all queued objects from the peer.
        // TODO depending in the REQUEST_THRESHOLD, we might need to split up
        // the getData request into multiple ones.
        this._peer.channel.getData(this._objectsToRequest.array);

        // Reset the queue.
        this._objectsToRequest = new IndexedArray([], true);

        // Set timer to detect end of request / missing objects
        this._timers.setTimeout('getData', () => this._noMoreData(), FullConsensusAgent.REQUEST_TIMEOUT);
    }

    _noMoreData() {
        // Cancel the request timeout timer.
        this._timers.clearTimeout('getData');

        // Reset objects in flight.
        this._objectsInFlight = null;

        // If there are more objects to request, request them.
        if (!this._objectsToRequest.isEmpty()) {
            this._requestData();
        }
        // Otherwise, request more blocks if we are still syncing the blockchain.
        else if (this._syncing) {
            this.syncBlockchain();
        }
    }

    /**
     * @param {BlockMessage} msg
     * @return {Promise}
     * @private
     */
    async _onBlock(msg) {
        const hash = await msg.block.hash();

        // Check if we have requested this block.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
            Log.w(FullConsensusAgent, `Unsolicited block ${hash} received from ${this._peer.peerAddress}, discarding`);
            // TODO What should happen here? ban? drop connection?
            // Might not be unsolicited but just arrive after our timeout has triggered.
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Put block into blockchain.
        const status = await this._blockchain.pushBlock(msg.block);

        // TODO send reject message if we don't like the block
        if (status === FullChain.ERR_INVALID) {
            this._peer.channel.ban('received invalid block');
        }
    }

    /**
     * @param {TxMessage} msg
     * @return {Promise}
     * @private
     */
    async _onTx(msg) {
        const hash = await msg.transaction.hash();
        Log.i(FullConsensusAgent, `[TX] Received transaction ${hash} from ${this._peer.peerAddress}`);

        // Check if we have requested this transaction.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
            Log.w(FullConsensusAgent, `Unsolicited transaction ${hash} received from ${this._peer.peerAddress}, discarding`);
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Put transaction into mempool.
        this._mempool.pushTransaction(msg.transaction);

        // TODO send reject message if we don't like the transaction
        // TODO what to do if the peer keeps sending invalid transactions?
    }

    /**
     * @param {NotFoundMessage} msg
     * @private
     */
    _onNotFound(msg) {
        Log.d(FullConsensusAgent, `[NOTFOUND] ${msg.vectors.length} unknown objects received from ${this._peer.peerAddress}`);

        // Remove unknown objects from in-flight list.
        for (const vector of msg.vectors) {
            if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
                Log.w(FullConsensusAgent, `Unsolicited notfound vector received from ${this._peer.peerAddress}, discarding`);
                continue;
            }

            this._onObjectReceived(vector);
        }
    }

    /**
     * @param {InvVector} vector
     * @private
     */
    _onObjectReceived(vector) {
        if (!this._objectsInFlight) return;

        // Remove the vector from the objectsInFlight.
        this._objectsInFlight.remove(vector);

        // Reset the request timeout if we expect more objects to come.
        if (!this._objectsInFlight.isEmpty()) {
            this._timers.resetTimeout('getData', () => this._noMoreData(), FullConsensusAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData();
        }
    }


    /* Request endpoints */

    /**
     * @param {GetDataMessage} msg
     * @return {Promise}
     * @private
     */
    async _onGetData(msg) {
        // Keep track of the objects the peer knows.
        for (const vector of msg.vectors) {
            this._knownObjects.add(vector);
        }

        // Check which of the requested objects we know.
        // Send back all known objects.
        // Send notFound for unknown objects.
        const unknownObjects = [];
        for (const vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._blockchain.getBlock(vector.hash); // eslint-disable-line no-await-in-loop
                    if (block) {
                        // We have found a requested block, send it back to the sender.
                        this._peer.channel.block(block);
                    } else {
                        // Requested block is unknown.
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION: {
                    const tx = await this._mempool.getTransaction(vector.hash); // eslint-disable-line no-await-in-loop
                    if (tx) {
                        // We have found a requested transaction, send it back to the sender.
                        this._peer.channel.tx(tx);
                    } else {
                        // Requested transaction is unknown.
                        unknownObjects.push(vector);
                    }
                    break;
                }
                default:
                    throw `Invalid inventory type: ${vector.type}`;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownObjects.length) {
            this._peer.channel.notFound(unknownObjects);
        }
    }

    /**
     * @param {GetHeaderMessage} msg
     * @return {Promise}
     * @private
     */
    async _onGetHeader(msg) {
        // Keep track of the objects the peer knows.
        for (const vector of msg.vectors) {
            this._knownObjects.add(vector);
        }

        // Check which of the requested objects we know.
        // Send back all known objects.
        // Send notFound for unknown objects.
        const unknownObjects = [];
        for (const vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._blockchain.getBlock(vector.hash); // eslint-disable-line no-await-in-loop
                    if (block) {
                        // We have found a requested block, send it back to the sender.
                        this._peer.channel.header(block.header);
                    } else {
                        // Requested block is unknown.
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION:
                default:
                    throw `Invalid inventory type: ${vector.type}`;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownObjects.length) {
            this._peer.channel.notFound(unknownObjects);
        }
    }

    /**
     * @param {GetBlocksMessage} msg
     * @return {Promise}
     * @private
     */
    async _onGetBlocks(msg) {
        Log.v(FullConsensusAgent, `[GETBLOCKS] ${msg.locators.length} block locators received from ${this._peer.peerAddress}`);

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
            FullConsensusAgent.GETBLOCKS_VECTORS_MAX, msg.direction === GetBlocksMessage.Direction.FORWARD);
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

    /**
     * @private
     * @returns {void}
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
 * Number of InvVectors in invToRequest pool to automatically trigger a getData request.
 * @type {number}
 */
FullConsensusAgent.REQUEST_THRESHOLD = 50;
/**
 * Time (ms) to wait after the last received inv message before sending getData.
 * @type {number}
 */
FullConsensusAgent.REQUEST_THROTTLE = 500;
/**
 * Maximum time (ms) to wait after sending out getData or receiving the last object for this request.
 * @type {number}
 */
FullConsensusAgent.REQUEST_TIMEOUT = 5000;
/**
 * Maximum number of blockchain sync retries before closing the connection.
 * XXX If the peer is on a long fork, it will count as a failed sync attempt
 * if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getBlocks)
 * blocks.
 * @type {number}
 */
FullConsensusAgent.MAX_SYNC_ATTEMPTS = 5;
/**
 * Maximum number of inventory vectors to sent in the response for onGetBlocks.
 * @type {number}
 */
FullConsensusAgent.GETBLOCKS_VECTORS_MAX = 500;
Class.register(FullConsensusAgent);
