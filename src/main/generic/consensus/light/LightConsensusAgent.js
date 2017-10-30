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
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Peer} */
        this._peer = peer;

        // Flag indicating that have synced our blockchain with the peer's.
        /** @type {boolean} */
        this._synced = false;

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
        peer.channel.on('not-found', msg => this._onNotFound(msg));
        peer.channel.on('header', msg => this._onHeader(msg));
        peer.channel.on('tx', msg => this._onTx(msg));

        peer.channel.on('chain-proof', msg => this._onChainProof(msg));
        peer.channel.on('accounts-proof', msg => this._onAccountsProof(msg));

        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));

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
     * @returns {Promise.<void>}
     */
    async syncBlockchain() {
        const headBlock = await this._blockchain.getBlock(this._peer.headHash);
        if (!headBlock) {
            this._requestChainProof();
        } else {
            this._syncFinished();
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        this._synced = true;
        this.fire('sync');
    }

    /**
     * @returns {void}
     * @private
     */
    _requestChainProof() {
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
            return;
        }

        // Push the proof into the LightChain.
        if (!(await this._blockchain.pushProof(msg.proof))) {
            Log.w(LightConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - verification failed`);
            // TODO ban instead?
            this._peer.channel.close('invalid chain proof');
            return;
        }

        // TODO add all blocks from the chain proof to knownObjects.

        this._syncFinished();
    }


    /**
     * @param {InvMessage} msg
     * @return {Promise}
     * @private
     */
    async _onInv(msg) {
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
                    if (!block) {
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION: {
                    // TODO
                    //const tx = await this._mempool.getTransaction(vector.hash); // eslint-disable-line no-await-in-loop
                    //if (!tx) {
                    //    unknownObjects.push(vector);
                    //}
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
        // TODO cleanup!
        const blocks = [];
        const transactions = [];
        for (const obj of this._objectsToRequest.array) {
            if (obj.type === InvVector.Type.BLOCK) {
                blocks.push(obj);
            } else {
                transactions.push(obj);
            }
        }

        this._peer.channel.getHeader(blocks);
        this._peer.channel.getData(transactions);

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
    }

    /**
     * @param {HeaderMessage} msg
     * @return {Promise}
     * @private
     */
    async _onHeader(msg) {
        const hash = await msg.header.hash();

        // Check if we have requested this block.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        if (!this._objectsInFlight || this._objectsInFlight.indexOf(vector) < 0) {
            Log.w(LightConsensusAgent, `Unsolicited header ${hash} received from ${this._peer.peerAddress}, discarding`);
            // TODO What should happen here? ban? drop connection?
            // Might not be unsolicited but just arrive after our timeout has triggered.
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Put block into blockchain.
        const status = await this._blockchain.pushHeader(msg.header);

        // TODO send reject message if we don't like the block
        if (status === LightChain.ERR_INVALID) {
            this._peer.channel.ban('received invalid header');
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
        // TODO
        // this._mempool.pushTransaction(msg.transaction);

        // TODO send reject message if we don't like the transaction
        // TODO what to do if the peer keeps sending invalid transactions?
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

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array.<Account>>}
     */
    getAccounts(addresses) {
        return this._synchronizer.push(() => {
            return this._getAccounts(addresses);
        });
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array<Account>>}
     * @private
     */
    _getAccounts(addresses) {
        Assert.that(this._accountsRequest === null);

        Log.d(LightConsensusAgent, `Requesting AccountsProof for ${addresses} from ${this._peer.peerAddress}`);

        return new Promise((resolve, reject) => {
            this._accountsRequest = {
                addresses: addresses,
                resolve: resolve,
                reject: reject
            };

            // Request AccountsProof from peer.
            this._peer.channel.getAccountsProof(addresses);

            // Drop the peer if it doesn't send the accounts proof within the timeout.
            this._timers.setTimeout('getAccountsProof', () => {
                this._peer.channel.close('getAccountsProof timeout');
                reject(new Error('timeout')); // TODO error handling
            }, LightConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {AccountsProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onAccountsProof(msg) {
        Log.d(LightConsensusAgent, `[ACCOUNTS-PROOF] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.proof}`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(LightConsensusAgent, `Unsolicited accounts proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear the request timeout.
        this._timers.clearTimeout('getAccountsProof');

        const addresses = this._accountsRequest.addresses;
        const resolve = this._accountsRequest.resolve;
        const reject = this._accountsRequest.reject;

        // Reset accountsRequest.
        this._accountsRequest = null;

        // Check that we know the reference block.
        // TODO Which blocks should be accept here?
        // XXX For now, we ONLY accept our head block. This will not work well in face of block propagation delays.
        if (!this._blockchain.headHash.equals(msg.blockHash)) {
            Log.w(LightConsensusAgent, `Received AccountsProof for block != head from ${this._peer.peerAddress}`);
            reject(new Error('Invalid reference block'));
            return;
        }

        // Verify the proof.
        const proof = msg.proof;
        if (!(await proof.verify())) {
            Log.w(LightConsensusAgent, `Invalid AccountsProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('Invalid AccountsProof');
            reject(new Error('Invalid AccountsProof'));
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = await proof.root();
        if (!this._blockchain.head.accountsHash.equals(rootHash)) {
            Log.w(LightConsensusAgent, `Invalid AccountsProof (root hash) received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('AccountsProof root hash mismatch');
            reject(new Error('AccountsProof root hash mismatch'));
            return;
        }

        // Check that all requested accounts are part of this proof.
        // XXX return a map address -> account instead?
        const accounts = [];
        for (const address of addresses) {
            try {
                const account = proof.getAccount(address);
                accounts.push(account);
            } catch (e) {
                Log.w(LightConsensusAgent, `Incomplete AccountsProof received from ${this._peer.peerAddress}`);
                // TODO ban instead?
                this._peer.channel.close('Incomplete AccountsProof');
                reject(new Error('Incomplete AccountsProof'));
                return;
            }
        }

        // Return the retrieved accounts.
        resolve(accounts);
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
LightConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT = 1000 * 5;
Class.register(LightConsensusAgent);
