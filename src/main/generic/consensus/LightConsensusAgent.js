class LightConsensusAgent extends Observable {
    /**
     * @param {Blockchain} blockchain
     * @param {Mempool} mempool
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, peer) {
        super();
        /** @type {Blockchain} */
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
        peer.channel.on('interlinkChain', msg => this._onInterlinkChain(msg));

        peer.channel.on('getInterlinkChain', msg => this._onGetInterlinkChain(msg));
        peer.channel.on('getAccountsProof', msg => this._onGetAccountsProof(msg));
        peer.channel.on('getHeaders', msg => this._onGetHeaders(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());

        // Wait for the blockchain to processes queued blocks before requesting more.
        this._blockchain.on('ready', () => {
            if (this._syncing) this.syncBlockchain();
        });
    }

    /* Public API */

    /**
     * 
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


    /* Private API */



    async _requestInterlinkChain() {
        // XXX Only one getInterlinkChain request at a time.
        // TODO do we need this?
        if (this._timers.timeoutExists('getInterlinkChain')) {
            Log.e(ConsensusAgent, 'Duplicate _requestInterlinkChain()');
            return;
        }

        // Request interlink chain from peer.
        const locators = await this._blockchain.getLocators();
        this._peer.channel.getInterlinkChain(/*TODO peer headHash */, Policy.M, locators);

        // Drop the peer if it doesn't send the interlink chain within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getInterlinkChain', () => {
            this._timers.clearTimeout('getInterlinkChain');
            this._peer.channel.close('getInterlinkChain timeout');
        }, LightConsensusAgent.INTERLINK_REQUEST_TIMEOUT);
    }


    /**
     * @param {InterlinkChainMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onInterlinkChain(msg) {
        // Check if we have requested an interlink chain, reject unsolicited ones.
        if (!this._timers.timeoutExists('getInterlinkChain')) {
            Log.w(LightConsensusAgent, `Unsolicited interlink chain received from ${this._peer}`);
            // TODO close/ban?
            return;
        }

        // Clear timeout.
        this._timers.clearTimeout('getInterlinkChain');

        // Check that interlink chain is valid.
        const interlinkChain = msg.interlinkChain;
        if (!(await interlinkChain.verify())) {
            Log.w(LightConsensusAgent, `Invalid interlink chain received from ${this._peer}`);
            // TODO ban instead?
            this._peer.channel.close('invalid interlink received');
            return;
        }

        // Check that interlink chain ends with the peer's head block.


        // Check that the interlink chain is either:
        // - rooted (starts with the genesis block) and either:
        //   - long enough (>=m)
        //   - dense (the peer's whole chain is less than m long)
        if (interlinkChain.isRooted() && (interlinkChain.length >= Policy.M || interlinkChain.isDense())) {
            // Interlink chain looks good
        }

        // - Starts with a block whose (interlink) predecessor is known to us.
        else if (this._blockchain.containsPredecessorOf(interlinkChain.tail)) {
            // Interlink chain looks good
        }

        // Otherwise, reject chain and drop peer.
        else {
            Log.w(LightConsensusAgent, `Invalid interlink chain received from ${this._peer}`);
            // TODO ban instead?
            this._peer.channel.close('invalid interlink received');
        }
    }


    /**
     * @param {GetInterlinkChainMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onGetInterlinkChain(msg) {
        const head = await this._blockchain.getBlock(msg.headHash);

        if (head) {
            const interlinkChain = await this._blockchain.getInterlinkChain(head, msg.m, msg.locators);
            this._peer.channel.interlinkChain(interlinkChain);
        }

        // TODO what to do if we do not know the requested head?
    }

    /**
     * @param {GetHeadersMessage} msg
     * @private
     */
    async _onGetHeaders(msg) {
        const head = await this._blockchain.getBlock(msg.blockHash);

        if (head) {
            const headerChain = await this._blockchain.getHeaderChain(head, msg.mustIncludeHash, msg.k, msg.hashes);
            this._peer.channel.headers(headerChain);
        }
        // TODO what to do if we do not know the requested head?
    }

    /**
     * @param {GetAccountsProofMessage} msg
     * @private
     */
    async _onGetAccountsProof(msg) {
        let accounts;
        try {
            accounts = await this._blockchain.getAccounts(msg.blockHash);
        } catch(e) {
            // TODO what should we do here?
            return;
        }

        const proof = await accounts.constructAccountsProof(msg.addresses);
        this._peer.channel.accountsProof(msg.blockHash, proof);
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
 * Maximum time (ms) to wait for interlinkChain after sending out getInterlinkChain before dropping the peer.
 * @type {number}
 */
LightConsensusAgent.INTERLINK_REQUEST_TIMEOUT = 1000 * 10; // 10 seconds
Class.register(LightConsensusAgent);
