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

    constructor(peer, blockchain, mempool) {
        super();
        this._peer = peer;
        this._blockchain = blockchain;
        this._mempool = mempool;

        // Flag indicating that we have sync'd our blockchain with the peer's.
        this._synced = false;

        // Invectory of all objects that we think the remote peer knows.
        this._knownObjects = {};

        // InvVectors we want to request via getdata are collected here and
        // periodically requested.
        this._objectsToRequest = [];

        // Helper object to keep track of in-flight getdata requests.
        this._inFlightRequests = new InFlightRequests();

        // Helper object to keep track of timeouts & intervals.
        this._timers = new Timers();

        // Listen to consensus messages from the peer.
        peer.channel.on('inv',        msg => this._onInv(msg));
        peer.channel.on('getdata',    msg => this._onGetData(msg));
        peer.channel.on('notfound',   msg => this._onNotFound(msg));
        peer.channel.on('block',      msg => this._onBlock(msg));
        peer.channel.on('tx',         msg => this._onTx(msg));
        peer.channel.on('getblocks',  msg => this._onGetBlocks(msg));
        peer.channel.on('mempool',    msg => this._onMempool(msg));

        // Start syncing our blockchain with the peer.
        // _syncBlockchain() might immediately emit events, so yield control flow
        // first to give listeners the chance to register first.
        setTimeout(this._syncBlockchain.bind(this), 0);
    }

    /* Public API */

    async relayBlock(block) {
        // Don't relay block to this peer if it already knows it.
        const hash = await block.hash();
        if (this._knownObjects[hash]) return;

        // Relay block to peer.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        this._peer.channel.inv([vector]);
    }

    async relayTransaction(transaction) {
        // Don't relay transaction to this peer if it already knows it.
        const hash = await transaction.hash();
        if (this._knownObjects[hash]) return;

        // Relay transaction to peer.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        this._peer.channel.inv([vector]);
    }

    _syncBlockchain() {
        // TODO Don't loop forver here!!
        // Save the last blockchain height when we issuing getblocks and when we get here again, see if it changed.
        // If it didn't the peer didn't give us any valid blocks. Try again or drop him!

        if (this._blockchain.height < this._peer.startHeight) {
            // If the peer has a longer chain than us, request blocks from it.
            this._requestBlocks();
        } else if (this._blockchain.height > this._peer.startHeight) {
            // The peer has a shorter chain than us.
            // TODO what do we do here?
            console.log('Peer ' + this._peer + ' has a shorter chain (' + this._peer.startHeight + ') than us');

            // XXX assume consensus state?
            this._synced = true;
            this.fire('consensus');
        } else {
            // We have the same chain height as the peer.
            // TODO Do we need to check that we have the same head???

            // Consensus established.
            this._synced = true;
            this.fire('consensus');
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
        this._timers.setTimeout('getblocks', () => this._peer.channel.close('getblocks timeout'), ConsensusAgent.REQUEST_TIMEOUT);
    }

    async _onInv(msg) {
        // Clear the getblocks timeout.
        this._timers.clearTimeout('getblocks');

        // Check which of the advertised objects we know
        // Request unknown objects, ignore known ones.
        const unknownObjects = []
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[INV] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                    if (!block) {
                        unknownObjects.push(vector);
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    const tx = await this._mempool.getTransaction(vector.hash);
                    console.log('[INV] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                    if (!tx) {
                        unknownObjects.push(vector);
                    }
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Keep track of the objects the peer knows.
        for (let obj of unknownObjects) {
            this._knownObjects[obj.hash] = obj;
        }

        if (unknownObjects.length) {
            // Store unknown vectors in objectsToRequest array.
            Array.prototype.push.apply(this._objectsToRequest, unknownObjects);

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
        // Request all queued objects from the peer.
        // TODO depending in the REQUEST_THRESHOLD, we might need to split up
        // the getdata request into multiple ones.
        this._peer.channel.getdata(this._objectsToRequest);

        // Keep track of this request.
        const requestId = this._inFlightRequests.push(this._objectsToRequest);

        // Reset the queue.
        this._objectsToRequest = [];

        // Set timer to detect end of request / missing objects
        this._timers.setTimeout('getdata_' + requestId, () => this._noMoreData(requestId), ConsensusAgent.REQUEST_TIMEOUT);
    }

    _noMoreData(requestId) {
        // Check if there are objects missing for this request.
        const objects = this._inFlightRequests.getObjects(requestId);
        const missingObjects = Object.keys(objects).length;
        if (missingObjects) {
            console.warn(missingObjects + ' missing objects for request ' + requestId, objects);
            // TODO what to do here?
        }

        // Cancel the request timeout timer.
        this._timers.clearTimeout('getdata_' + requestId);

        // Delete the request.
        this._inFlightRequests.deleteRequest(requestId);

        // If we haven't fully sync'ed the blockchain yet, keep on syncing.
        if (!this._synced) {
            this._syncBlockchain();
        }
    }

    async _onBlock(msg) {
        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64());

        // Check if we have requested this block.
        if (!this._inFlightRequests.getRequestId(hash)) {
            console.warn('Unsolicited block ' + hash + ' received from peer ' + this._peer + ', discarding', msg.block);
            return;
        }

        // Put block into blockchain
        const accepted = await this._blockchain.pushBlock(msg.block);

        // TODO send reject message if we don't like the block
        // TODO what to do if the peer keeps sending invalid blocks?

        this._onObjectReceived(hash);
    }

    async _onTx(msg) {
        const hash = await msg.transaction.hash();
        console.log('[TX] Received transaction ' + hash.toBase64(), msg.transaction);

        // Check if we have requested this transaction.
        if (!this._inFlightRequests.getRequestId(hash)) {
            console.warn('Unsolicited transaction ' + hash + ' received from peer ' + this._peer + ', discarding', msg.block);
            return;
        }

        // Put transaction into mempool.
        const accepted = await this._mempool.pushTransaction(msg.transaction);

        // TODO send reject message if we don't like the transaction
        // TODO what to do if the peer keeps sending invalid transactions?

        this._onObjectReceived(hash);
    }

    _onNotFound(msg) {
        console.log('[NOTFOUND] ' + msg.vectors.length + ' unknown objects', msg.vectors);

        // Remove unknown objects from in-flight list.
        for (let obj of msg.vectors) {
            const requestId = this._inFlightRequests.getRequestId(obj.hash);
            if (!requestId) {
                console.warn('Unsolicited notfound vector ' + obj + ' from peer ' + this._peer, obj);
                continue;
            }

            console.log('Peer ' + this._peer + ' did not find ' + obj, obj);

            this._onObjectReceived(obj.hash);
        }
    }

    _onObjectReceived(hash) {
        // Mark the getdata request for this object as complete.
        const requestId = this._inFlightRequests.getRequestId(hash);
        if (!requestId) {
            console.warn('Could not find requestId for ' + hash);
            return;
        }
        this._inFlightRequests.deleteObject(hash);

        // Check if we have received all objects for this request.
        const objects = this._inFlightRequests.getObjects(requestId);
        if (!objects) {
            console.warn('Could not find objects for requestId ' + requestId);
            return;
        }
        const moreObjects = Object.keys(objects).length > 0;

        // Reset the request timeout if we expect more objects to come.
        if (moreObjects) {
            this._timers.resetTimeout('getdata_' + requestId, () => this._noMoreData(requestId), ConsensusAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData(requestId);
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
                case InvVector.Type.BLOCK:
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

                case InvVector.Type.TRANSACTION:
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
            if (this._blockchain.path.length !== this._blockchain.height)
                throw 'Blockchain.path.length != Blockchain.height';

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
}
Class.register(ConsensusAgent);

class InFlightRequests {
    constructor() {
        this._index = {};
        this._array = [];
        this._requestId = 1;
    }

    push(objects) {
        this._array[this._requestId] = {};
        for (let obj of objects) {
            this._index[obj.hash] = this._requestId;
            this._array[this._requestId][obj.hash] = obj;
        }
        return this._requestId++;
    }

    getObjects(requestId) {
        return this._array[requestId];
    }

    getRequestId(hash) {
        return this._index[hash];
    }

    deleteObject(hash) {
        const requestId = this._index[hash];
        if (!requestId) return;
        delete this._array[requestId][hash];
        delete this._index[hash];
    }

    deleteRequest(requestId) {
        const objects = this._array[requestId];
        if (!objects) return;
        for (let hash in objects) {
            delete this._index[hash];
        }
        delete this._array[requestId];
    }
}
Class.register(InFlightRequests);
