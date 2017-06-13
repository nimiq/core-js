class ConsensusAgent extends Observable {
    constructor(blockchain, mempool, peer) {
        super();
        this._blockchain = blockchain;
        this._mempool = mempool;
        this._peer = peer;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        this._syncing = false;

        // Flag indicating that have synced our blockchain with the peer's.
        this._synced = false;

        // The height of our blockchain when we last attempted to sync the chain.
        this._lastChainHeight = 0;

        // The number of failed blockchain sync attempts.
        this._failedSyncs = 0;

        // Set of all objects (InvVectors) that we think the remote peer knows.
        this._knownObjects = new HashSet();

        // InvVectors we want to request via getdata are collected here and
        // periodically requested.
        this._objectsToRequest = new IndexedArray([], true);

        // Objects that are currently being requested from the peer.
        this._objectsInFlight = null;

        // Helper object to keep track of timeouts & intervals.
        this._timers = new Timers();

        // Listen to consensus messages from the peer.
        peer.channel.on('inv',          msg => this._onInv(msg));
        peer.channel.on('getdata',      msg => this._onGetData(msg));
        peer.channel.on('notfound',     msg => this._onNotFound(msg));
        peer.channel.on('block',        msg => this._onBlock(msg));
        peer.channel.on('tx',           msg => this._onTx(msg));
        peer.channel.on('getblocks',    msg => this._onGetBlocks(msg));
        peer.channel.on('mempool',      msg => this._onMempool(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());

        // Wait for the blockchain to processes queued blocks before requesting more.
        this._blockchain.on('ready', () => {
            if (this._syncing) this.syncBlockchain();
        });
    }

    /* Public API */

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

    syncBlockchain() {
        this._syncing = true;

        // If the blockchain is still busy processing blocks, wait for it to catch up.
        if (this._blockchain.busy) {
            Log.v(ConsensusAgent, 'Blockchain busy, waiting ...');
        }
        // If we already requested blocks from the peer but it didn't give us any
        // good ones, retry or drop the peer.
        else if (this._lastChainHeight === this._blockchain.height) {
            this._failedSyncs++;
            if (this._failedSyncs < ConsensusAgent.MAX_SYNC_ATTEMPTS) {
                this._requestBlocks();
            } else {
                this._peer.channel.ban('blockchain sync failed');
            }
        }
        // If the peer has a longer chain than us, request blocks from it.
        else if (this._blockchain.height < this._peer.startHeight) {
            this._lastChainHeight = this._blockchain.height;
            this._requestBlocks();
        }
        // The peer has a shorter chain than us.
        // TODO what do we do here?
        else if (this._blockchain.height > this._peer.startHeight) {
            Log.v(ConsensusAgent, `Peer ${this._peer.peerAddress} has a shorter chain (${this._peer.startHeight}) than us`);

            // XXX assume consensus state?
            this._syncing = false;
            this._synced = true;
            this.fire('sync');
        }
        // We have the same chain height as the peer.
        // TODO Do we need to check that we have the same head???
        else {
            // Consensus established.
            this._syncing = false;
            this._synced = true;
            this.fire('sync');
        }
    }

    _requestBlocks() {
        // XXX Only one getblocks request at a time.
        if (this._timers.timeoutExists('getblocks')) {
            Log.e(ConsensusAgent, `Duplicate _requestBlocks()`);
            return;
        }

        // Request blocks starting from our hardest chain head going back to
        // the genesis block. Space out blocks more when getting closer to the
        // genesis block.
        const hashes = [];
        let step = 1;
        for (let i = this._blockchain.path.length - 1; i >= 0; i -= step) {
            // Push top 10 hashes first, then back off exponentially.
            if (hashes.length >= 10) {
                step *= 2;
            }
            hashes.push(this._blockchain.path[i]);
        }

        // Push the genesis block hash.
        if (hashes.length === 0 || !hashes[hashes.length-1].equals(Block.GENESIS.HASH)) {
            hashes.push(Block.GENESIS.HASH);
        }

        // Request blocks from peer.
        this._peer.channel.getblocks(hashes);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getblocks', () => {
            this._timers.clearTimeout('getblocks');
            this._peer.channel.close('getblocks timeout');
        }, ConsensusAgent.REQUEST_TIMEOUT);
    }

    async _onInv(msg) {
        // Clear the getblocks timeout.
        this._timers.clearTimeout('getblocks');

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
                    const block = await this._blockchain.getBlock(vector.hash);
                    if (!block) {
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION: {
                    const tx = await this._mempool.getTransaction(vector.hash);
                    if (!tx) {
                        unknownObjects.push(vector);
                    }
                    break;
                }
                default:
                    throw `Invalid inventory type: ${vector.type}`;
            }
        }

        Log.v(ConsensusAgent, `[INV] ${msg.vectors.length} vectors (${unknownObjects.length} new) received from ${this._peer.peerAddress}`);

        if (unknownObjects.length > 0) {
            // Store unknown vectors in objectsToRequest array.
            for (const obj of unknownObjects) {
                this._objectsToRequest.push(obj);
            }

            // Clear the request throttle timeout.
            this._timers.clearTimeout('inv');

            // If there are enough objects queued up, send out a getdata request.
            if (this._objectsToRequest.length >= ConsensusAgent.REQUEST_THRESHOLD) {
                this._requestData();
            }
            // Otherwise, wait a short time for more inv messages to arrive, then request.
            else {
                this._timers.setTimeout('inv', () => this._requestData(), ConsensusAgent.REQUEST_THROTTLE);
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
        // the getdata request into multiple ones.
        this._peer.channel.getdata(this._objectsToRequest.array);

        // Reset the queue.
        this._objectsToRequest = new IndexedArray([], true);

        // Set timer to detect end of request / missing objects
        this._timers.setTimeout('getdata', () => this._noMoreData(), ConsensusAgent.REQUEST_TIMEOUT);
    }

    _noMoreData() {
        // Cancel the request timeout timer.
        this._timers.clearTimeout('getdata');

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

    async _onBlock(msg) {
        const hash = await msg.block.hash();

        // Check if we have requested this block.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
            Log.w(ConsensusAgent, `Unsolicited block ${hash} received from ${this._peer.peerAddress}, discarding`);
            // TODO What should happen here? ban? drop connection?
            // Might not be unsolicited but just arrive after our timeout has triggered.
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Put block into blockchain.
        const status = await this._blockchain.pushBlock(msg.block);

        // TODO send reject message if we don't like the block
        if (status === Blockchain.PUSH_ERR_INVALID_BLOCK) {
            this._peer.channel.ban('received invalid block');
        }
    }

    async _onTx(msg) {
        const hash = await msg.transaction.hash();
        Log.i(ConsensusAgent, `[TX] Received transaction ${hash} from ${this._peer.peerAddress}`);

        // Check if we have requested this transaction.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
            Log.w(ConsensusAgent, `Unsolicited transaction ${hash} received from ${this._peer.peerAddress}, discarding`);
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Put transaction into mempool.
        this._mempool.pushTransaction(msg.transaction);

        // TODO send reject message if we don't like the transaction
        // TODO what to do if the peer keeps sending invalid transactions?
    }

    _onNotFound(msg) {
        Log.d(ConsensusAgent, `[NOTFOUND] ${msg.vectors.length} unknown objects received from ${this._peer.peerAddress}`);

        // Remove unknown objects from in-flight list.
        for (const vector of msg.vectors) {
            if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
                Log.w(ConsensusAgent, `Unsolicited notfound vector received from ${this._peer.peerAddress}, discarding`);
                continue;
            }

            this._onObjectReceived(vector);
        }
    }

    _onObjectReceived(vector) {
        if (!this._objectsInFlight) return;

        // Remove the vector from the objectsInFlight.
        this._objectsInFlight.remove(vector);

        // Reset the request timeout if we expect more objects to come.
        if (!this._objectsInFlight.isEmpty()) {
            this._timers.resetTimeout('getdata', () => this._noMoreData(), ConsensusAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData();
        }
    }


    /* Request endpoints */

    async _onGetData(msg) {
        // Keep track of the objects the peer knows.
        for (const vector of msg.vectors) {
            this._knownObjects.add(vector);
        }

        // Check which of the requested objects we know.
        // Send back all known objects.
        // Send notfound for unknown objects.
        const unknownObjects = [];
        for (const vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._blockchain.getBlock(vector.hash);
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
                    const tx = await this._mempool.getTransaction(vector.hash);
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
            this._peer.channel.notfound(unknownObjects);
        }
    }

    async _onGetBlocks(msg) {
        Log.v(ConsensusAgent, `[GETBLOCKS] ${msg.hashes.length} block locators received from ${this._peer.peerAddress}`);

        // A peer has requested blocks. Check all requested block locator hashes
        // in the given order and pick the first hash that is found on our main
        // chain, ignore the rest. If none of the requested hashes is found,
        // pick the genesis block hash. Send the main chain starting from the
        // picked hash back to the peer.
        // TODO honor hashStop argument
        const mainPath = this._blockchain.path;
        let startIndex = -1;

        for (const hash of msg.hashes) {
            // Shortcut for genesis block which will be the only block sent by
            // fresh peers.
            if (Block.GENESIS.HASH.equals(hash)) {
                startIndex = 0;
                break;
            }

            // Check if we know the requested block.
            const block = await this._blockchain.getBlock(hash);

            // If we don't know the block, try the next one.
            if (!block) continue;

            // If the block is not on our main chain, try the next one.
            // mainPath is an IndexedArray with constant-time .indexOf()
            startIndex = mainPath.indexOf(hash);
            if (startIndex < 0) continue;

            // We found a block, ignore remaining block locator hashes.
            break;
        }

        // If we found none of the requested blocks on our main chain,
        // start with the genesis block.
        if (startIndex < 0) {
            // XXX Assert that the full path back to genesis is available in
            // blockchain.path. When the chain grows very long, it makes no
            // sense to keep the full path in memory.
            // We relax this assumption for clients that have a checkpoint loaded.
            if (this._blockchain.path.length !== this._blockchain.height
                    && !(this._blockchain.path.length > 0 && this._blockchain.checkPointLoaded && this._blockchain.path[0].equals(Block.CHECKPOINT.HASH))) {
                throw 'Blockchain.path.length != Blockchain.height';
            }

            startIndex = 0;
        }

        // Collect up to GETBLOCKS_VECTORS_MAX inventory vectors for the blocks starting right
        // after the identified block on the main chain.
        const stopIndex = Math.min(mainPath.length - 1, startIndex + ConsensusAgent.GETBLOCKS_VECTORS_MAX);
        const vectors = [];
        for (let i = startIndex + 1; i <= stopIndex; ++i) {
            vectors.push(new InvVector(InvVector.Type.BLOCK, mainPath[i]));
        }

        // Send the vectors back to the requesting peer.
        this._peer.channel.inv(vectors);
    }

    async _onMempool(msg) {
        // Query mempool for transactions
        const transactions = await this._mempool.getTransactions();

        // Send transactions back to sender.
        for (const tx of transactions) {
            this._peer.channel.tx(tx);
        }
    }

    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        this.fire('close', this);
    }

    get peer() {
        return this._peer;
    }

    get synced() {
        return this._synced;
    }
}
// Number of InvVectors in invToRequest pool to automatically trigger a getdata request.
ConsensusAgent.REQUEST_THRESHOLD = 50;
// Time to wait after the last received inv message before sending getdata.
ConsensusAgent.REQUEST_THROTTLE = 500; // ms
// Maximum time to wait after sending out getdata or receiving the last object for this request.
ConsensusAgent.REQUEST_TIMEOUT = 5000; // ms
// Maximum number of blockchain sync retries before closing the connection.
// XXX If the peer is on a long fork, it will count as a failed sync attempt
// if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getblocks)
// blocks.
ConsensusAgent.MAX_SYNC_ATTEMPTS = 5;
// Maximum number of inventory vectors to sent in the response for onGetBlocks.
ConsensusAgent.GETBLOCKS_VECTORS_MAX = 500;
Class.register(ConsensusAgent);
