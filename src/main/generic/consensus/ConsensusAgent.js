class ConsensusAgent extends Observable {
    // Number of InvVectors in invToRequest pool to automatically trigger a getdata request.
    static get REQUEST_THRESHOLD() {
        return 50;
    }

    // Time to wait after the last received inv message before sending getdata.
    static get REQUEST_THROTTLE() {
        return 500; // ms
    }

    // Maximum time to wait after sending out getdata or receiving the last object for this request.
    static get REQUEST_TIMEOUT() {
        return 5000; // ms
    }

    // Maximum number of blockchain sync retries before closing the connection.
    // XXX If the peer is on a long fork, it will count as a failed sync attempt
    // if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getblocks)
    // blocks.
    static get MAX_SYNC_ATTEMPTS() {
        return 5;
    }

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

        // Invectory of all objects that we think the remote peer knows.
        this._knownObjects = {};

        // InvVectors we want to request via getdata are collected here and
        // periodically requested.
        this._objectsToRequest = new IndexedArray([], true);

        // Objects that are currently being requested from the peer.
        this._objectsInFlight = null;

        // Helper object to keep track of timeouts & intervals.
        this._timers = new Timers();

        // Listen to consensus messages from the peer.
        peer.channel.on('inv', msg => this._onInv(msg));
        peer.channel.on('getdata', msg => this._onGetData(msg));
        peer.channel.on('notfound', msg => this._onNotFound(msg));
        peer.channel.on('block', msg => this._onBlock(msg));
        peer.channel.on('tx', msg => this._onTx(msg));
        peer.channel.on('getblocks', msg => this._onGetBlocks(msg));
        peer.channel.on('mempool', msg => this._onMempool(msg));

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

        // Don't relay block to this peer if it already knows it.
        const hash = await block.hash();
        if (this._knownObjects[hash]) return;

        // Relay block to peer.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        this._peer.channel.inv([vector]);
    }

    async relayTransaction(transaction) {
        // TODO Don't relay if no consensus established yet ???

        // Don't relay transaction to this peer if it already knows it.
        const hash = await transaction.hash();
        if (this._knownObjects[hash]) return;

        // Relay transaction to peer.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        this._peer.channel.inv([vector]);
    }

    syncBlockchain() {
        this._syncing = true;

        // If the blockchain is still busy processing blocks, wait for it to catch up.
        if (this._blockchain.busy) {
            console.log('Blockchain busy, waiting ...');
        }
        // If we already requested blocks from the peer but it didn't give us any
        // good ones, retry or drop the peer.
        else if (this._lastChainHeight == this._blockchain.height) {
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
            console.log('Peer ' + this._peer + ' has a shorter chain (' + this._peer.startHeight + ') than us');

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
        // Request blocks starting from our hardest chain head going back to
        // the genesis block. Space out blocks more when getting closer to the
        // genesis block.
        const hashes = [];
        let step = 1;
        for (let i = this._blockchain.height - 1; i > 0; i -= step) {
            // Push top 10 hashes first, then back off exponentially.
            if (hashes.length >= 10) {
                step *= 2;
            }
            hashes.push(this._blockchain.path[i]);
        }

        // Push the genesis block hash.
        hashes.push(Block.GENESIS.HASH);

        // Request blocks from peer.
        this._peer.channel.getblocks(hashes);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getblocks', () => this._peer.channel.close('getblocks timeout'), ConsensusAgent.REQUEST_TIMEOUT);
    }

    async _onInv(msg) {
        // Clear the getblocks timeout.
        this._timers.clearTimeout('getblocks');

        // Check which of the advertised objects we know
        // Request unknown objects, ignore known ones.
        const unknownObjects = [];
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._blockchain.getBlock(vector.hash);
                    //console.log('[INV] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                    if (!block) {
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION: {
                    const tx = await this._mempool.getTransaction(vector.hash);
                    //console.log('[INV] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                    if (!tx) {
                        unknownObjects.push(vector);
                    }
                    break;
                }
                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        console.log('[INV] ' + msg.vectors.length + ' vectors, ' + unknownObjects.length + ' previously unknown');

        // Keep track of the objects the peer knows.
        for (let obj of unknownObjects) {
            this._knownObjects[obj.hash] = obj;
        }

        if (unknownObjects.length) {
            // Store unknown vectors in objectsToRequest array.
            for (let obj of unknownObjects) {
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
        }
    }

    async _requestData() {
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
        //console.log('[BLOCK] Received block ' + hash.toBase64());

        // Check if we have requested this block.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        if (this._objectsInFlight.indexOf(vector) < 0) {
            console.warn('Unsolicited block ' + hash + ' received from peer ' + this._peer + ', discarding');
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Put block into blockchain.
        this._blockchain.pushBlock(msg.block);

        // TODO send reject message if we don't like the block
        // TODO what to do if the peer keeps sending invalid blocks?
    }

    async _onTx(msg) {
        const hash = await msg.transaction.hash();
        console.log('[TX] Received transaction ' + hash.toBase64());

        // Check if we have requested this transaction.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        if (this._objectsInFlight.indexOf(vector) < 0) {
            console.warn('Unsolicited transaction ' + hash + ' received from peer ' + this._peer + ', discarding');
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
        console.log('[NOTFOUND] ' + msg.vectors.length + ' unknown objects', msg.vectors);

        // Remove unknown objects from in-flight list.
        for (let vector of msg.vectors) {
            if (this._objectsInFlight.indexOf(vector) < 0) {
                console.warn('Unsolicited notfound vector ' + vector + ' from peer ' + this._peer, vector);
                continue;
            }

            console.log('Peer ' + this._peer + ' did not find ' + obj, obj);

            this._onObjectReceived(vector);
        }
    }

    _onObjectReceived(vector) {
        if (!this._objectsInFlight) return;

        // Remove the vector from the objectsInFlight.
        this._objectsInFlight.delete(vector);

        // Reset the request timeout if we expect more objects to come.
        if (!this._objectsInFlight.isEmpty()) {
            this._timers.resetTimeout('getdata', () => this._noMoreData(), ConsensusAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData();
        }
    }


    /* Request endpoints */

    async _onGetData(msg) {
        // check which of the requested objects we know
        // send back all known objects
        // send notfound for unknown objects
        const unknownObjects = [];
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[GETDATA] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
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
                    console.log('[GETDATA] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
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
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownObjects.length) {
            this._peer.channel.notfound(unknownObjects);
        }
    }

    async _onGetBlocks(msg) {
        console.log('[GETBLOCKS] Request for blocks, ' + msg.hashes.length + ' block locators');

        // A peer has requested blocks. Check all requested block locator hashes
        // in the given order and pick the first hash that is found on our main
        // chain, ignore the rest. If none of the requested hashes is found,
        // pick the genesis block hash. Send the main chain starting from the
        // picked hash back to the peer.
        // TODO honor hashStop argument
        const mainPath = this._blockchain.path;
        let startIndex = -1;

        for (let hash of msg.hashes) {
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
            if (this._blockchain.path.length !== this._blockchain.height) {
                throw 'Blockchain.path.length != Blockchain.height';
            }

            startIndex = 0;
        }

        // Collect up to 500 inventory vectors for the blocks starting right
        // after the identified block on the main chain.
        const stopIndex = Math.min(mainPath.length - 1, startIndex + 500);
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
        for (let tx of transactions) {
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
Class.register(ConsensusAgent);
