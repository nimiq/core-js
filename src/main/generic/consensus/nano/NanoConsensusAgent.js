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
        peer.channel.on('get-interlink-chain', msg => this._onGetInterlinkChain(msg));
        peer.channel.on('interlink-chain', msg => this._onInterlinkChain(msg));
        peer.channel.on('get-headers', msg => this._onGetHeaders(msg));
        peer.channel.on('headers', msg => this._onHeaders(msg));
        peer.channel.on('get-accounts-proof', msg => this._onGetAccountsProof(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());

        // Wait for the blockchain to processes queued blocks before requesting more.
        this._blockchain.on('ready', () => {
            //if (this._syncing) this.syncBlockchain();
        });
    }

    /**
     * @param {Block} block
     * @returns {Promise}
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
     * @returns {Promise}
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
        this._syncing = true;

        // Check if our head corresponds to the peer's head.
        if (this._blockchain.headHash.equals(this._peer.headHash)) {
            // If the dense portion of the blockchain is long enough, we're done syncing.
            if (this._blockchain.denseLength >= Policy.K) {
                this._syncFinished();
            }
            // Otherwise, request header chain from the peer.
            else {
                this._requestHeaderChain();
            }
        }
        // Otherwise, check if we already know the peer's head block. If so, there is nothing new to be learned from this peer.
        else {
            const headBlock = await this._blockchain.getBlock(this._peer.headHash);
            if (headBlock) {
                this._syncFinished();
                return;
            }

            // If we don't know the peer's head block, request interlink chain.
            this._requestInterlinkChain();
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        this._syncing = false;
        this._synced = true;
        this.fire('sync');
    }


    /**
     * @returns {Promise.<void>}
     * @private
     */
    async _requestInterlinkChain() {
        assert(!this._timers.timeoutExists('getInterlinkChain'));

        // Request interlink chain from peer.
        const locators = await this._blockchain.getLocators();
        this._peer.channel.getInterlinkChain(this._peer.headHash, locators, Policy.M);

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
        Log.d(LightConsensusAgent, `[INTERLINK] Received from ${this._peer.peerAddress}: ${msg.interlinkChain}`);

        // Check if we have requested an interlink chain, reject unsolicited ones.
        if (!this._timers.timeoutExists('getInterlinkChain')) {
            Log.w(LightConsensusAgent, `Unsolicited interlink chain received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear timeout.
        this._timers.clearTimeout('getInterlinkChain');

        // Check that interlink chain is valid.
        const interlinkChain = msg.interlinkChain;
        if (!(await interlinkChain.verify())) {
            Log.w(LightConsensusAgent, `Invalid interlink chain received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('invalid interlink received');
            return;
        }

        // Check that interlink chain ends with the peer's head block.
        const headHash = await interlinkChain.head.hash();
        if (!this._peer.headHash.equals(headHash)) {
            Log.w(LightConsensusAgent, `Invalid interlink chain received from ${this._peer.peerAddress} - unexpected head`);
            // TODO ban instead?
            this._peer.channel.close('invalid interlink received - unexpected head');
            return;
        }

        // Check that the interlink chain is either:
        // - rooted (starts with the genesis block) and either:
        //   - long enough (>=m)
        //   - dense (the peer's whole chain is less than m long)
        // - Starts with a block whose (interlink) predecessor is known to us (i.e. the chain can be shorter
        //   if one of the locator hashes was encountered during construction).
        if ((await interlinkChain.isRooted() && (interlinkChain.length >= Policy.M || await interlinkChain.isDense()))
                || await this._blockchain.containsPredecessorOf(interlinkChain.tail)) {

            // Interlink chain looks good. Add all blocks to our blockchain.
            const promises = [];
            for (const block of interlinkChain.blocks) {
                promises.push(this._blockchain.push(block));
            }

            // If not all blocks were pushed successfully, drop the peer.
            const results = await Promise.all(promises);
            Log.d(LightConsensusAgent, `Added ${interlinkChain.length} blocks to blockchain`);

            if (results.some(result => !result)) {
                this._peer.channel.close('invalid interlink received - push failed');
                return;
            }

            // Interlink chain successfully received, continue syncing.
            if (this._syncing) {
                this.syncBlockchain();
            }
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
        Log.d(LightConsensusAgent, `[GET-INTERLINK] Received from ${this._peer.peerAddress}: headHash=${msg.headHash}, m=${msg.m}, locators=${msg.locators}`);

        const head = await this._blockchain.getBlock(msg.headHash);
        if (head) {
            const interlinkChain = await this._blockchain.getInterlinkChain(head, msg.locators, msg.m);
            this._peer.channel.interlinkChain(interlinkChain);
        } else {
            // TODO what to do if we do not know the requested head?
            Log.w(LightConsensusAgent, `Requested interlink head not found: ${msg.headHash}`);
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _requestHeaderChain() {
        assert(!this._timers.timeoutExists('getHeaderChain'));

        // Request headers from peer.
        this._peer.channel.getHeaders(Policy.K, this._blockchain.headHash);

        // Drop the peer if it doesn't send the headers within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getHeaderChain', () => {
            this._timers.clearTimeout('getHeaderChain');
            this._peer.channel.close('getHeaderChain timeout');
        }, LightConsensusAgent.HEADERS_REQUEST_TIMEOUT);
    }

    /**
     * @param {HeadersMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onHeaders(msg) {
        Log.d(LightConsensusAgent, `[HEADERS] Received from ${this._peer.peerAddress}: ${msg.headerChain}`);

        // Check if we have requested a header chain, reject unsolicited ones.
        if (!this._timers.timeoutExists('getHeaderChain')) {
            Log.w(LightConsensusAgent, `Unsolicited header chain received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear timeout.
        this._timers.clearTimeout('getHeaderChain');

        // TODO verify header chain?
        const headerChain = msg.headerChain;

        // Add blocks to blockchain.
        const promises = [];
        for (const block of headerChain.blocks) {
            promises.push(this._blockchain.push(block));
        }

        // If not all blocks were pushed successfully, drop the peer.
        const results = await Promise.all(promises);
        Log.d(LightConsensusAgent, `Added ${headerChain.length} blocks to blockchain`);

        if (results.some(result => !result)) {
            this._peer.channel.close('invalid headers received - push failed');
            return;
        }

        // Header chain successfully received, continue syncing.
        if (this._syncing) {
            this.syncBlockchain();
        }
    }


    /**
     * @param {GetHeadersMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onGetHeaders(msg) {
        Log.d(LightConsensusAgent, `[GET-HEADERS] Received from ${this._peer.peerAddress}: headHash=${msg.headHash}, k=${msg.k}`);

        const head = await this._blockchain.getBlock(msg.headHash);
        if (head) {
            const headerChain = await this._blockchain.getHeaderChain(msg.k, head);
            this._peer.channel.headers(headerChain);
        } else {
            // TODO what to do if we do not know the requested head?
            Log.w(LightConsensusAgent, `Requested headers head not found: ${msg.headHash}`);
        }
    }

    /**
     * @param {GetAccountsProofMessage} msg
     * @returns {Promise.<void>}
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
LightConsensusAgent.HEADERS_REQUEST_TIMEOUT = 1000 * 10; // 10 seconds
Class.register(LightConsensusAgent);
