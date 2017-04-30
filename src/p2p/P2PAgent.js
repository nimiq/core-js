class P2PAgent extends Observable {

    /*

    Types:
    1. [A] Announcement -> (no response)
    2. [REQ] Request -> [RES] Response
    3. [REQ] Request -> [A] Announcement

    1. [A] INV
    2. [REQ] VERSION    ->  [RES] VERACK
    2. [REQ] GETDATA    ->  [RES] BLOCK
                            [RES] TX
                            [RES] NOTFOUND
    2. [REQ] GETHEADERS ->  [RES] HEADERS
    3. [REQ] GETBLOCKS  ->  [A] INV
    3. [REQ] MEMPOOL    ->  [A] INV

    [State: Initial]
    Version Handshake
    - (to peer) send VERSION
    - expect: VERSION
    -- timeout: drop peer
    - (from peer) receive VERSION
    - (to peer) send VERACK
    - expect: VERACK
    -- timeout: drop peer
    -> State: Established

    No other messages allowed in this state.


    [State: Established]
    new properties: peer.chainHeight (VERSION)

    If peer.chainHeight > ourChainHeight Then: Request blocks
      - (to peer) send GETBLOCKS (including genesis block locator)
      - expect: INV
      -- timeout: ignore/retry/drop peer?
      - (from peer) receive INV
      Put inventory vectors in INV_TO_REQUEST pool
      Trigger GETDATA request immediately (don't wait for pool to fill up)
    Else:
      TODO What to do here? Do we just assume the peer has the same chain as us?
      -> State: Synched

    If INV_IN_FLIGHT pool-empty fires: (after potential blockchain head update)
      If peer.chainHeight > ourChainHeight Then:
        Request more blocks (see above)
      Else:
        Somehow check if the blockchain head matches
        -> State: Synched



    OnBlock: {
      if it is not in the INV_IN_FLIGHT pool, we received the block unsolicited. TODO what to do here?
      try to push block into blockchain
      send REJECT message if that fails
      remove block from INV_IN_FLIGHT pool (fire pool-empty event)
    }

    OnTx: {
      if it is not in the INV_IN_FLIGHT pool, we received the transaction unsolicited. TODO what to do here?
      try to push tx into mempool
      send REJECT message if that fails
      remove tx from INV_IN_FLIGHT pool (fire pool-empty event)
    }

    OnNotFound: {

        remove vector(s) from INV_IN_FLIGHT pool (fire pool-empty event)
    }

    OnInv: {
      put vectors into request pool
      send GETDATA if pool size reaches threshold
    }

    inv: {
      Check known objects and drop inv message if we think that the peer already knows that object.
    }

    getdata: {
      Grab all inv vectors from INV_TO_REQUEST pool (in order!!!!)
      Put vectors into INV_IN_FLIGHT pool
      Clear INV_TO_REQUEST pool
      send request(s) for inv vectors

      // TODO setup timer to watch for failed requests
    }

    getblocks {

    }
    mempool: {

    }

    INV_TO_REQUEST POOL:
    Ordering is important!!!
    Inv Pool Processing:
      setInterval() on inv message if not already running
      send current inv vectors when timer triggers

    When putting inv vectors into the pool:
    if (INV_TO_REQUEST.length > THRESHOLD) {
        send GETDATA request with all queued inv vectors
        put inv vectors into INV_IN_FLIGHT pool
        clear out INV_TO_REQUEST pool
    }

    INV_IN_FLIGHT POOL:



    Known objects:
    1. Peer -> Us
    - (from peer) announced via inv
    - (to peer) requested via getdata
    - (from peer) received via block/tx
    2. Us -> Peer
    - (to peer) announced via inv
    - (from peer) requested via getdata
    - (to peer) sent via block/tx



    Properties:
      peerChainHeight
      invInFlight
      invToRequest
      invKnown ?


    */

    static get HANDSHAKE_TIMEOUT() {
        return 10000; // [ms]
    }

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

        // The main state of the agent: INITAL, CONNECTED, CONSENSUS
        this._state = P2PAgent.State.INITIAL;

        // The announced height of the peer's best chain.
        this._startHeight = null;

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
        peer.on('version',    msg => this._onVersion(msg));
        peer.on('verack',     msg => this._onVerAck(msg));
        peer.on('inv',        msg => this._onInv(msg));
        peer.on('getdata',    msg => this._onGetData(msg));
        peer.on('notfound',   msg => this._onNotFound(msg));
        peer.on('block',      msg => this._onBlock(msg));
        peer.on('tx',         msg => this._onTx(msg));
        peer.on('getblocks',  msg => this._onGetBlocks(msg));
        peer.on('mempool',    msg => this._onMempool(msg));

        // Initiate the protocol with the new peer.
        this._handshake();
    }

    /* Public API */
    async relayBlock(block) {
        // Don't relay block to this peer if it already knows it.
        const hash = await block.hash();
        if (this._knownObjects[hash]) return;

        // Relay block to peer.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        this._peer.inv([vector]);
    }

    async relayTransaction(transaction) {
        // Don't relay transaction to this peer if it already knows it.
        const hash = await transaction.hash();
        if (this._knownObjects[hash]) return;

        // Relay transaction to peer.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        this._peer.inv([vector]);
    }

    /* Initial State: Handshake */

    async _handshake() {
        // Kick off the handshake by telling the peer our version & blockchain height.
        this._peer.version(this._blockchain.height);

        // Drop the peer if it doesn't acknowledge our version message.
        this._timers.setTimeout('verack', () => this._peer.close(), P2PAgent.HANDSHAKE_TIMEOUT);

        // Drop the peer if it doesn't send us a version message.
        this._timers.setTimeout('version', () => this._peer.close(), P2PAgent.HANDSHAKE_TIMEOUT);
    }

    async _onVersion(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Reject duplicate version messages.
        if (this._startHeight) {
            this._peer.reject('version', RejectP2PMessage.Code.DUPLICATE);
            return;
        }

        // TODO actually check version, services and stuff.

        // Clear the version timeout.
        this._timers.clearTimeout('version');

        // Acknowledge the receipt of the version message.
        this._peer.verack();

        // Store the announced chain height.
        this._startHeight = msg.startHeight;
    }

    _onVerAck(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERACK]');

        // Clear the version message timeout.
        this._timers.clearTimeout('verack');

        // Fail if the peer didn't send a version message first.
        if (!this._startHeight) {
            console.warn('Dropping peer ' + this._peer + ' - no version message received (verack)');
            this._peer.close();
            return;
        }

        // Handshake completed, connection established.
        this._state = P2PAgent.State.CONNECTED;
        this.fire('connected');

        // Initiate blockchain sync.
        this._sync();
    }


    /* Connected State: Sync blockchain */

    _sync() {
        // TODO Don't loop forver here!!
        // Save the last blockchain height when we issuing getblocks and when we get here again, see if it changed.
        // If it didn't the peer didn't give us any valid blocks. Try again or drop him!

        if (this._blockchain.height < this._startHeight) {
            // If the peer has a longer chain than us, request blocks from it.
            this._requestBlocks();
        } else if (this._blockchain.height > this._startHeight) {
            // The peer has a shorter chain than us.
            // TODO what do we do here?
            console.log('Peer ' + this._peer + ' has a shorter chain (' + this._startHeight + ') than us');

            // XXX assume consensus state?
            this._state = P2PAgent.State.CONSENSUS;
            this.fire('consensus');
        } else {
            // We have the same chain height as the peer.
            // TODO Do we need to check that we have the same head???

            // Consensus established.
            this._state = P2PAgent.State.CONSENSUS;
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
        this._peer.getblocks(hashes);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        this._timers.setTimeout('getblocks', () => this._peer.close(), P2PAgent.REQUEST_TIMEOUT);
    }

    async _onInv(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
            if (this._objectsToRequest.length >= P2PAgent.REQUEST_THRESHOLD) {
                this._requestData();
            }
            // Otherwise, wait a short time for more inv messages to arrive, then request.
            else {
                this._timers.setTimeout('inv', () => this._requestData(), P2PAgent.REQUEST_THROTTLE);
            }
        }
    }

    async _requestData() {
        // Request all queued objects from the peer.
        // TODO depending in the REQUEST_THRESHOLD, we might need to split up
        // the getdata request into multiple ones.
        this._peer.getdata(this._objectsToRequest);

        // Keep track of this request.
        const requestId = this._inFlightRequests.push(this._objectsToRequest);

        // Reset the queue.
        this._objectsToRequest = [];

        // Set timer to detect end of request / missing objects
        this._timers.setTimeout('getdata_' + requestId, () => this._noMoreData(requestId), P2PAgent.REQUEST_TIMEOUT);
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

        // If we are still in connected state, keep on synching.
        if (this._state == P2PAgent.State.CONNECTED) {
            this._sync();
        }
    }

    async _onBlock(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64(), msg.block);

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
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
        this._inFlightRequests.deleteObject(hash);

        // Check if we have received all objects for this request.
        const objects = this._inFlightRequests.getObjects(requestId);
        const moreObjects = Object.keys(objects).length > 0;

        // Reset the request timeout if we expect more objects to come.
        if (moreObjects) {
            this._timers.resetTimeout('getdata_' + requestId, () => this._noMoreData(requestId), P2PAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData(requestId);
        }
    }


    /* Request endpoints */

    async _onGetData(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
                        this._peer.block(block);
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
                        this._peer.tx(tx);
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
            this._peer.notfound(unknownObjects);
        }
    }

    async _onGetBlocks(msg) {
        console.log('[GETBLOCKS] Request for blocks, ' + msg.hashes.length + ' block locators');

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
        this._peer.inv(vectors);
    }

    async _onMempool(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        // Query mempool for transactions
        const transactions = await this._mempool.getTransactions();

        // Send transactions back to sender.
        for (let tx of transactions) {
            this._peer.tx(tx);
        }
    }

    _canAcceptMessage(msg) {
        const isHandshakeMsg =
            msg.type == P2PMessage.Type.VERSION
            || msg.type == P2PMessage.Type.VERACK;

        switch (this._state) {
            case P2PAgent.State.INITIAL:
                if (!isHandshakeMsg) {
                    console.warn('Discarding message ' + msg.type + ' from peer ' + this._peer + ' - not acceptable in state ' + this._state, msg);
                }
                return isHandshakeMsg;
            default:
                if (isHandshakeMsg) {
                    console.warn('Discarding message ' + msg.type + ' from peer ' + this._peer + ' - not acceptable in state ' + this._state, msg);
                }
                return !isHandshakeMsg;
        }
    }
}
P2PAgent.State = {};
P2PAgent.State.INITIAL = 'initial';
P2PAgent.State.CONNECTED = 'connected';
P2PAgent.State.CONSENSUS = 'consensus';
//P2PAgent.State.DISCORD = 3;


class Timers {
    constructor() {
        this._timeouts = {};
        this._intervals = {};
    }

    setTimeout(key, fn, waitTime) {
        if (this._timeouts[key]) throw 'Duplicate timeout for key ' + key;
        this._timeouts[key] = setTimeout(fn, waitTime);
    }

    clearTimeout(key) {
        clearTimeout(this._timeouts[key]);
        delete this._timeouts[key];
    }

    resetTimeout(key, fn, waitTime) {
        clearTimeout(this._timeouts[key]);
        this._timeouts[key] = setTimeout(fn, waitTime);
    }

    setInterval(key, fn, intervalTime) {
        if (this._intervals[key]) throw 'Duplicate interval for key ' + key;
        this._intervals[key] = setInterval(fn, intervalTime);
    }

    clearInterval(key) {
        clearInterval(this._intervals[key]);
        delete this._intervals[key];
    }

    resetInterval(key, fn, intervalTime) {
        clearInterval(this._intervals[key]);
        this._intervals[key] = setInterval(fn, intervalTime);
    }
}

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
