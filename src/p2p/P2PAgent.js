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

    OnInv: {

    }
    
    inv: {
      Check known objects and drop inv message if we think that the peer already knows that object.
    }

    getdata: {

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

    */

    constructor(peer, blockchain, mempool) {
        this._peer = peer;
        this._blockchain = blockchain;
        this._mempool = mempool;

        peer.on('version',    msg => this._onVersion(msg));
        peer.on('inv',        msg => this._onInv(msg));
        peer.on('getdata',    msg => this._onGetData(msg));
        peer.on('notfound',   msg => this._onNotFound(msg));
        peer.on('block',      msg => this._onBlock(msg));
        peer.on('tx',         msg => this._onTx(msg));
        peer.on('getblocks',  msg => this._onGetBlocks(msg));
        peer.on('mempool',    msg => this._onMempool(msg));

        // Start speaking our P2P protocol with this peer.
        this._startProtocol();
    }

    async _startProtocol() {
        // Kick off the protocol by telling the peer our version & blockchain height.
        this._peer.version(this._blockchain.height);
    }

    async _onVersion(msg) {
        // The peer told us his version.
        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Check if it claims to have a longer chain.
        if (this._blockchain.height < msg.startHeight) {
            console.log('Peer ' + sender.peerId + ' has longer chain (ours='
                + this._blockchain.height + ', theirs=' + msg.startHeight
                + '), requesting blocks');

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
            sender.getblocks(hashes);
        }
    }

    async _onInv(msg, sender) {
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

    async _onGetData(msg, sender) {
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

    _onNotFound(msg, sender) {
        // TODO
    }

    async _onBlock(msg, sender) {
        // TODO verify block
        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64(), msg.block);

        // put block into blockchain
        await this._blockchain.pushBlock(msg.block);
    }

    async _onTx(msg, sender) {
        // TODO verify transaction
        const hash = await msg.transaction.hash();
        console.log('[TX] Received transaction ' + hash.toBase64(), msg.transaction);

        await this._mempool.pushTransaction(msg.transaction);
    }

    async _onGetBlocks(msg, sender) {
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
            // The mainPath is an IndexedArray with constant-time .indexOf()
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

    async _onMempool(msg, sender) {
        // Query mempool for transactions
        const transactions = await this._mempool.getTransactions();

        // Send transactions back to sender.
        for (let tx of transactions) {
            sender.tx(tx);
        }
    }
}
