class LightConsensusAgent extends Observable {
    /**
     * @param {LightChain} blockchain
     * @param {Mempool} mempool
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, peer) {
        super();
        /** @type {LightChain} */
        this._blockchain = blockchain;
        /** @type {PartialLightChain} */
        this._partialChain = null;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Peer} */
        this._peer = peer;

        /** @type {boolean} */
        this._syncing = false;

        // Flag indicating whether we do a full catchup or request a proof.
        /** @type {boolean} */
        this._catchup = false;

        // Flag indicating whether we believe to be on the main chain of the client.
        /** @type {boolean} */
        this._onMainChain = false;

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
        this._knownObjects.add(new InvVector(InvVector.Type.BLOCK, peer.headHash));

        // InvVectors we want to request via getData are collected here and
        // periodically requested.
        /** @type {IndexedArray} */
        this._objectsToRequest = new IndexedArray([], true);

        // Objects that are currently being requested from the peer.
        this._objectsInFlight = null;

        // Helper object to keep track of timeouts & intervals.
        /** @type {Timers} */
        this._timers = new Timers();

        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        // Helper object to keep track of the accounts we're requesting from the peer.
        this._accountsRequest = null;

        // Listen to consensus messages from the peer.
        peer.channel.on('inv', msg => this._onInv(msg));
        peer.channel.on('get-data', msg => this._onGetData(msg));
        peer.channel.on('get-header', msg => this._onGetHeader(msg));
        peer.channel.on('not-found', msg => this._onNotFound(msg));
        peer.channel.on('block', msg => this._onBlock(msg));
        peer.channel.on('tx', msg => this._onTx(msg));
        peer.channel.on('get-blocks', msg => this._onGetBlocks(msg));
        peer.channel.on('mempool', msg => this._onMempool(msg));
        peer.channel.on('header', msg => this._onHeader(msg));

        peer.channel.on('chain-proof', msg => this._onChainProof(msg));
        peer.channel.on('accounts-tree-chunk', msg => this._onAccountsTreeChunk(msg));
        peer.channel.on('accounts-rejected', msg => this._onAccountsRejected(msg));

        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));
        peer.channel.on('get-accounts-proof', msg => this._onGetAccountsProof(msg));
        peer.channel.on('get-accounts-tree-chunk', msg => this._onGetAccountsTreeChunk(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());
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

    /**
     * @returns {Promise.<void>}
     */
    async syncBlockchain() {
        // Ban peer if the sync failed more often than allowed.
        if (this._failedSyncs >= LightConsensusAgent.MAX_SYNC_ATTEMPTS) {
            this._peer.channel.ban('blockchain sync failed');
            if (this._partialChain) {
                await this._partialChain.abort();
            }
        }

        // Check if we know head block.
        const block = this._partialChain
            ? await this._partialChain.getBlock(this._peer.headHash)
            : await this._blockchain.getBlock(this._peer.headHash);

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

            let header;
            try {
                header = await this.getHeader(this._peer.headHash);
            } catch(err) {
                this._peer.channel.close('Did not get requested header');
                return;
            }

            // Check how to sync:
            this._catchup = header.height - this._blockchain.height <= Policy.NUM_BLOCKS_VERIFICATION;
            Log.d(LightConsensusAgent, `Start syncing, catchup mode: ${this._catchup}`);
        }

        // Case 3: We are are syncing.
        if (this._syncing) {
            if (this._catchup) {
                if (block) {
                    this._syncFinished();
                } else {
                    this._requestBlocks();
                }
            } else {
                // Initialize partial chain on first call.
                if (!this._partialChain) {
                    await this._initChainProofSync();
                }

                // If the blockchain is still busy processing blocks, wait for it to catch up.
                if (this._partialChain.busy) {
                    Log.v(FullConsensusAgent, 'Blockchain busy, waiting ...');
                    return;
                }

                switch (this._partialChain.state) {
                    case PartialLightChain.State.PROVE_CHAIN:
                        this._requestChainProof();
                        this._onMainChain = true;
                        break;
                    case PartialLightChain.State.PROVE_ACCOUNTS_TREE:
                        this._requestAccountsTree();
                        break;
                    case PartialLightChain.State.PROVE_BLOCKS:
                        this._requestProofBlocks();
                        break;
                    case PartialLightChain.State.COMPLETE:
                        if (!block) {
                            this._requestBlocks();
                        } else {
                            // Commit state on success.
                            await this._partialChain.commit();
                            this._syncFinished();
                        }
                        break;
                    case PartialLightChain.State.ABORTED:
                        this._syncFinished();
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
        this._syncing = true;
        this._synced = false;
        this._catchup = false;

        if (this._partialChain) {
            await this._partialChain.abort();
        }

        this._partialChain = await this._blockchain.partialChain();
        // Wait for the blockchain to processes queued blocks before requesting more.
        this._partialChain.on('ready', () => {
            if (this._syncing && (this._partialChain.state === PartialLightChain.State.PROVE_BLOCKS
                || this._partialChain.state === PartialLightChain.State.COMPLETE)) {
                this.syncBlockchain();
            }
        });
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        if (this._partialChain) {
            this._partialChain = null;
        }
        this._syncing = false;
        this._failedSyncs = 0;

        this._synced = true;
        this.fire('sync');
    }
    
    async _requestProofBlocks() {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_BLOCKS);

        // If nothing happend since the last request, increase failed syncs.
        if (this._lastChainHeight === this._partialChain.proofHeadHeight) {
            this._failedSyncs++;
        }
        this._lastChainHeight = this._partialChain.proofHeadHeight;

        // XXX Only one getBlocks request at a time.
        if (this._timers.timeoutExists('getBlocks')) {
            Log.e(LightConsensusAgent, 'Duplicate _requestProofBlocks()');
            return;
        }

        // Request blocks from peer.
        this._peer.channel.getBlocks(await this._partialChain.getBlockLocators(), Policy.NUM_BLOCKS_VERIFICATION, false);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getBlocks', () => {
            this._timers.clearTimeout('getBlocks');
            this._peer.channel.close('getBlocks timeout');
        }, LightConsensusAgent.REQUEST_TIMEOUT);
    }

    async _requestBlocks() {
        // XXX Only one getBlocks request at a time.
        if (this._timers.timeoutExists('getBlocks')) {
            Log.e(LightConsensusAgent, 'Duplicate _requestBlocks()');
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
        this._peer.channel.getBlocks(locators, this._onMainChain ? LightConsensusAgent.GETBLOCKS_VECTORS_MAX : 1);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getBlocks', () => {
            this._timers.clearTimeout('getBlocks');
            this._peer.channel.close('getBlocks timeout');
        }, LightConsensusAgent.REQUEST_TIMEOUT);
    }

    async _requestAccountsTree() {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_ACCOUNTS_TREE);

        this._requestAccountsTreeChunk(this._partialChain.getMissingAccountsPrefix(), this._partialChain.headHash);
    }

    /**
     * @param {string} startPrefix
     * @param {Hash} headHash
     * @private
     */
    _requestAccountsTreeChunk(startPrefix, headHash) {
        Assert.that(!this._timers.timeoutExists('getAccountsTreeChunk'));

        Log.d(LightConsensusAgent, `Requesting AccountsTreeChunk starting at ${startPrefix} from ${this._peer.peerAddress}`);

        this._accountsRequest = {
            startPrefix: startPrefix,
            blockHash: headHash
        };

        // Request AccountsProof from peer.
        this._peer.channel.getAccountsTreeChunk(headHash, startPrefix);

        // Drop the peer if it doesn't send the accounts proof within the timeout.
        this._timers.setTimeout('getAccountsTreeChunk', () => {
            this._peer.channel.close('getAccountsTreeChunk timeout');
        }, LightConsensusAgent.ACCOUNTS_TREE_CHUNK_REQUEST_TIMEOUT);
    }

    /**
     * @returns {void}
     * @private
     */
    _requestChainProof() {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_CHAIN);
        Assert.that(!this._timers.timeoutExists('getChainProof'));

        // Request ChainProof from peer.
        this._peer.channel.getChainProof();

        // Drop the peer if it doesn't send the chain proof within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getChainProof', () => {
            this._peer.channel.close('getChainProof timeout');
        }, LightConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT);
    }

    /**
     * @param {ChainProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onChainProof(msg) {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_CHAIN);
        Log.d(LightConsensusAgent, `[CHAIN-PROOF] Received from ${this._peer.peerAddress}: ${msg.proof} (${msg.proof.serializedSize} bytes)`);

        // Check if we have requested an interlink chain, reject unsolicited ones.
        if (!this._timers.timeoutExists('getChainProof')) {
            Log.w(LightConsensusAgent, `Unsolicited chain proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear timeout.
        this._timers.clearTimeout('getChainProof');

        // Check that the peer's head block is contained in the proof suffix.
        let headFound = false;
        const suffix = msg.proof.suffix;
        for (let i = suffix.length - 1; i >= 0; i--) {
            const header = suffix.headers[i];
            const hash = await header.hash();
            if (hash.equals(this._peer.headHash)) {
                headFound = true;
                break;
            }
        }
        if (!headFound) {
            Log.w(LightConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - unexpected head`);
            // TODO ban instead?
            this._peer.channel.close('invalid chain proof');
            await this._partialChain.abort();
            return;
        }

        // Push the proof into the LightChain.
        if (!(await this._partialChain.pushProof(msg.proof))) {
            Log.w(LightConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - verification failed`);
            // TODO ban instead?
            this._peer.channel.close('invalid chain proof');
            await this._partialChain.abort();
            return;
        }

        // TODO add all blocks from the chain proof to knownObjects.

        this.syncBlockchain();
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
                    const block = await this._blockchain.getBlock(vector.hash); // eslint-disable-line no-await-in-loop
                    if (!block || !block.isFull()) {
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

        Log.v(LightConsensusAgent, `[INV] ${msg.vectors.length} vectors (${unknownObjects.length} new) received from ${this._peer.peerAddress}`);

        if (unknownObjects.length > 0) {
            // Store unknown vectors in objectsToRequest array.
            for (const obj of unknownObjects) {
                this._objectsToRequest.push(obj);
            }

            // Clear the request throttle timeout.
            this._timers.clearTimeout('inv');

            // If there are enough objects queued up, send out a getData request.
            if (this._objectsToRequest.length >= LightConsensusAgent.REQUEST_THRESHOLD) {
                this._requestData();
            }
            // Otherwise, wait a short time for more inv messages to arrive, then request.
            else {
                this._timers.setTimeout('inv', () => this._requestData(), LightConsensusAgent.REQUEST_THROTTLE);
            }
        }
    }

    /**
     * @private
     */
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
        this._timers.setTimeout('getData', () => this._noMoreData(), LightConsensusAgent.REQUEST_TIMEOUT);
    }

    /**
     * @private
     */
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
            Log.w(LightConsensusAgent, `Unsolicited block ${hash} received from ${this._peer.peerAddress}, discarding`);
            // TODO What should happen here? ban? drop connection?
            // Might not be unsolicited but just arrive after our timeout has triggered.
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // If we find that we are on a fork far away from our chain, resync.
        if (msg.block.height < this._chain.height - Policy.NUM_BLOCKS_VERIFICATION
            && (!this._partialChain || this._partialChain.state !== PartialLightChain.State.PROVE_BLOCKS)) {
            this._onMainChain = false;
            await this._initChainProofSync();
            this.syncBlockchain();
            return;
        } else {
            this._onMainChain = true;
        }

        // Put block into blockchain.
        const status = await this._chain.pushBlock(msg.block);

        // TODO send reject message if we don't like the block
        if (status === LightChain.ERR_INVALID) {
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
        Log.i(LightConsensusAgent, `[TX] Received transaction ${hash} from ${this._peer.peerAddress}`);

        // Check if we have requested this transaction.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
            Log.w(LightConsensusAgent, `Unsolicited transaction ${hash} received from ${this._peer.peerAddress}, discarding`);
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
            this._timers.setTimeout('getHeader', () => {
                this._headerRequest = null;
                this._peer.channel.close('getHeader timeout');
                reject(new Error('timeout')); // TODO error handling
            }, LightConsensusAgent.REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {HeaderMessage} msg
     * @return {Promise}
     * @private
     */
    async _onHeader(msg) {
        const hash = await msg.header.hash();

        // Check if we have requested this block.
        if (!this._headerRequest) {
            Log.w(NanoConsensusAgent, `Unsolicited header ${hash} received from ${this._peer.peerAddress}, discarding`);
            // TODO What should happen here? ban? drop connection?
            return;
        }

        // Clear the request timeout.
        this._timers.clearTimeout('getHeader');

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

        resolve(msg.header);
    }

    /**
     * @param {NotFoundMessage} msg
     * @private
     */
    _onNotFound(msg) {
        Log.d(LightConsensusAgent, `[NOTFOUND] ${msg.vectors.length} unknown objects received from ${this._peer.peerAddress}`);

        // Remove unknown objects from in-flight list.
        for (const vector of msg.vectors) {
            if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
                Log.w(LightConsensusAgent, `Unsolicited notfound vector received from ${this._peer.peerAddress}, discarding`);
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
            this._timers.resetTimeout('getData', () => this._noMoreData(), LightConsensusAgent.REQUEST_TIMEOUT);
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
        Log.v(LightConsensusAgent, `[GETBLOCKS] ${msg.locators.length} block locators received from ${this._peer.peerAddress}`);

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
            Math.min(msg.maxInvSize, LightConsensusAgent.GETBLOCKS_VECTORS_MAX),
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
     * @param {AccountsTreeChunkMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onAccountsTreeChunk(msg) {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_ACCOUNTS_TREE);
        
        Log.d(LightConsensusAgent, `[ACCOUNTS-TREE-CHUNK] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.chunk}`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(LightConsensusAgent, `Unsolicited accounts tree chunk received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear the request timeout.
        this._timers.clearTimeout('getAccountsTreeChunk');

        const startPrefix = this._accountsRequest.startPrefix;
        const blockHash = this._accountsRequest.blockHash;

        // Reset accountsRequest.
        this._accountsRequest = null;

        // Check that we know the reference block.
        if (!blockHash.equals(msg.blockHash) || msg.chunk.head.prefix <= startPrefix) {
            Log.w(LightConsensusAgent, `Received AccountsTreeChunk for block != head or wrong start prefix from ${this._peer.peerAddress}`);
            this._peer.channel.close('Invalid AccountsTreeChunk');
            await this._partialChain.abort();
            return;
        }

        // Verify the proof.
        const chunk = msg.chunk;
        if (!(await chunk.verify())) {
            Log.w(LightConsensusAgent, `Invalid AccountsTreeChunk received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('Invalid AccountsTreeChunk');
            await this._partialChain.abort();
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = await chunk.root();
        const block = await this._partialChain.getBlock(blockHash);
        if (!block.accountsHash.equals(rootHash)) {
            Log.w(LightConsensusAgent, `Invalid AccountsTreeChunk (root hash) received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('AccountsTreeChunk root hash mismatch');
            await this._partialChain.abort();
            return;
        }

        // Return the retrieved accounts.
        const result = await this._partialChain.pushAccountsTreeChunk(chunk);

        // Something went wrong!
        if (result !== PartialAccountsTree.OK_UNFINISHED && result !== PartialAccountsTree.OK_COMPLETE) {
            // TODO maybe ban?
            Log.e(`AccountsTree sync failed with error code ${result} from ${this._peer.peerAddress}`);
            this._peer.channel.close('AccountsTreeChunk root hash mismatch');
            await this._partialChain.abort();
        }

        this.syncBlockchain();
    }

    /**
     * @param {AccountsRejectedMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onAccountsRejected(msg) {
        Log.d(LightConsensusAgent, `[ACCOUNTS-REJECTED] Received from ${this._peer.peerAddress}`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(LightConsensusAgent, `Unsolicited accounts rejected received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear the request timeout.
        this._timers.clearTimeout('getAccountsTreeChunk');

        // Reset accountsRequest.
        this._accountsRequest = null;

        // Restart syncing.
        await this._partialChain.abort();
        this._partialChain = null;
        this._syncing = false;
        this._failedSyncs++;
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
     * @returns {void}
     * @private
     */
    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        // Clear the synchronizer queue.
        this._synchronizer.clear();

        this.fire('close', this);
    }

    /**
     * @param {Hash} blockHash
     * @returns {boolean}
     */
    knowsBlock(blockHash) {
        const vector = new InvVector(InvVector.Type.BLOCK, blockHash);
        return this._knownObjects.contains(vector);
    }

    /** @type {Peer} */
    get peer() {
        return this._peer;
    }

    /** @type {boolean} */
    get synced() {
        return this._synced;
    }

    /** @type {LightChain} */
    get _chain() {
        if (this._syncing && !this._catchup) {
            Assert.that(!!this._partialChain);
            return this._partialChain;
        }
        return this._blockchain;
    }
}
/**
 * Number of InvVectors in invToRequest pool to automatically trigger a getData request.
 * @type {number}
 */
LightConsensusAgent.REQUEST_THRESHOLD = 50;
/**
 * Time (ms) to wait after the last received inv message before sending getData.
 * @type {number}
 */
LightConsensusAgent.REQUEST_THROTTLE = 500;
/**
 * Maximum time (ms) to wait after sending out getData or receiving the last object for this request.
 * @type {number}
 */
LightConsensusAgent.REQUEST_TIMEOUT = 1000 * 5;
/**
 * Maximum time (ms) to wait for chainProof after sending out getChainProof before dropping the peer.
 * @type {number}
 */
LightConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT = 1000 * 10;
/**
 * Maximum time (ms) to wait for chainProof after sending out getChainProof before dropping the peer.
 * @type {number}
 */
LightConsensusAgent.ACCOUNTS_TREE_CHUNK_REQUEST_TIMEOUT = 1000 * 5;
/**
 * Maximum number of blockchain sync retries before closing the connection.
 * XXX If the peer is on a long fork, it will count as a failed sync attempt
 * if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getBlocks)
 * blocks.
 * @type {number}
 */
LightConsensusAgent.MAX_SYNC_ATTEMPTS = 5;
/**
 * Maximum number of inventory vectors to sent in the response for onGetBlocks.
 * @type {number}
 */
LightConsensusAgent.GETBLOCKS_VECTORS_MAX = 500;
Class.register(LightConsensusAgent);
