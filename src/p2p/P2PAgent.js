class P2PAgent {

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

    static get TIMEOUT {
        return 10000; // ms
    }

    constructor(peer, blockchain, mempool) {
        this._peer = peer;
        this._blockchain = blockchain;
        this._mempool = mempool;

        // The main state of the agent: INITAL, CONNECTED, CONSENSUS
        this._state = P2PAgent.State.INITIAL;

        // The announced height of the peer's best chain.
        this._startHeight = null;

        // Invectory of all objects that we think the remote peer knows.
        this._knownObjects = {};

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

        // Start speaking our P2P protocol with this peer.
        this._handshake();
    }

    /* Initial State: Handshake */

    async _handshake() {
        // Kick off the protocol by telling the peer our version & blockchain height.
        this._peer.version(this._blockchain.height);

        // Drop the peer if it doesn't acknowledge our version message.
        this._timers.setTimeout('verack', () => this._peer.close(), P2PAgent.TIMEOUT);

        // Drop the peer if it doesn't send us a version message.
        this._timers.setTimeout('version', () => this._peer.close(), P2PAgent.TIMEOUT);
    }

    async _onVersion(msg) {
        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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

    _onVerAck() {
        console.log('[VERACK]');

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
        _sync();
    }


    /* Connected State: Sync blockchain */
    _sync() {
        while (this._blockchain.height < this._startHeight) {
            // try to sync
        }

        // Check that we have the same head
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
    }


    async _onInv(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        // Check which of the advertised objects we know
        // Request unknown objects, ignore known ones.
        const unknownVectors = []
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[INV] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                    if (!block) {
                        unknownVectors.push(vector);
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    const tx = await this._mempool.getTransaction(vector.hash);
                    console.log('[INV] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                    if (!tx) {
                        unknownVectors.push(vector);
                    }
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Request all unknown objects.
        if (unknownVectors.length) {
            sender.getdata(unknownVectors);
        }
    }

    async _onGetData(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        // check which of the requested objects we know
        // send back all known objects
        // send notfound for unknown objects
        const unknownVectors = [];
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[GETDATA] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                    if (block) {
                        // We have found a requested block, send it back to the sender.
                        sender.block(block);
                    } else {
                        // Requested block is unknown.
                        unknownVectors.push(vector);
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    const tx = await this._mempool.getTransaction(vector.hash);
                    console.log('[GETDATA] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                    if (tx) {
                        // We have found a requested transaction, send it back to the sender.
                        sender.tx(tx);
                    } else {
                        // Requested transaction is unknown.
                        unknownVectors.push(vector);
                    }
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownVectors.length) {
            sender.notfound(unknownVectors);
        }
    }

    _onNotFound(msg) {
        // TODO
    }

    async _onBlock(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        // TODO verify block
        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64(), msg.block);

        // put block into blockchain
        await this._blockchain.pushBlock(msg.block);
    }

    async _onTx(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        // TODO verify transaction
        const hash = await msg.transaction.hash();
        console.log('[TX] Received transaction ' + hash.toBase64(), msg.transaction);

        await this._mempool.pushTransaction(msg.transaction);
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
        sender.inv(vectors);
    }

    async _onMempool(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        // Query mempool for transactions
        const transactions = await this._mempool.getTransactions();

        // Send transactions back to sender.
        for (let tx of transactions) {
            sender.tx(tx);
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
P2PAgent.State.INITIAL = 0;
P2PAgent.State.CONNECTED = 1;
P2PAgent.State.CONSENSUS = 2;
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

    setInterval(key, fn, intervalTime) {
        if (this._intervals[key]) throw 'Duplicate intervals for key ' + key;
        this._intervals[key] = setInterval(fn, intervalTime);
    }

    clearInterval(key) {
        clearInterval(this._intervals[key]);
        delete this._intervals[key];
    }
}
