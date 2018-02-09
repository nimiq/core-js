class NanoConsensusAgent extends BaseConsensusAgent {
    /**
     * @param {NanoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Time} time
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, time, peer) {
        super(peer);
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {NanoMempool} */
        this._mempool = mempool;
        /** @type {Time} */
        this._time = time;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        /** @type {boolean} */
        this._syncing = false;

        /** @type {Array.<BlockHeader>} */
        this._orphanedBlocks = [];

        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        // Helper object to keep track of the accounts we're requesting from the peer.
        this._accountsRequest = null;

        // Helper object to keep track of the transactions we're requesting from the peer.
        this._transactionsRequest = null;

        // Helper object to keep track of full blocks we're requesting from the peer.
        this._blockRequest = null;

        // Flag to track chain proof requests.
        this._requestedChainProof = false;

        // Flag to track transaction receipts requests.
        this._requestedTransactionReceipts = false;

        // Listen to consensus messages from the peer.
        peer.channel.on('chain-proof', msg => this._onChainProof(msg));
        peer.channel.on('accounts-proof', msg => this._onAccountsProof(msg));
        peer.channel.on('transactions-proof', msg => this._onTransactionsProof(msg));
        peer.channel.on('transaction-receipts', msg => this._onTransactionReceipts(msg));

        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));

        // Subscribe to all announcements from the peer.
        /** @type {Subscription} */
        this._localSubscription = Subscription.BLOCKS_ONLY;
        this._peer.channel.subscribe(this._localSubscription);
    }

    /**
     * @param {Array.<Address>} addresses
     */
    subscribeAccounts(addresses) {
        this._localSubscription = Subscription.fromAddresses(addresses);
        this._peer.channel.subscribe(Subscription.BLOCKS_ONLY);
        
        this._timers.resetTimeout('subscription-change', () => {
            this._peer.channel.subscribe(this._localSubscription);
        }, NanoConsensusAgent.SUBSCRIPTION_CHANGE_THROTTLE);
    }

    /**
     * @returns {Promise.<void>}
     */
    async syncBlockchain() {
        this._syncing = true;

        const headBlock = await this._blockchain.getBlock(this._peer.headHash);
        if (!headBlock) {
            this._requestChainProof();
            this.fire('sync-chain-proof', this._peer.peerAddress);
        } else {
            this._syncFinished();
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
     * @returns {void}
     * @private
     */
    _requestChainProof() {
        // Only one chain proof request at a time.
        if (this._requestedChainProof) {
            return;
        }

        // Request ChainProof from peer.
        this._peer.channel.getChainProof();
        this._requestedChainProof = true;

        // Drop the peer if it doesn't send the chain proof within the timeout.
        this._peer.channel.expectMessage(Message.Type.CHAIN_PROOF, () => {
            this._peer.channel.close('getChainProof timeout');
        }, NanoConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT, NanoConsensusAgent.CHAINPROOF_CHUNK_TIMEOUT);
    }

    /**
     * @param {ChainProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onChainProof(msg) {
        Log.d(NanoConsensusAgent, `[CHAIN-PROOF] Received from ${this._peer.peerAddress}: ${msg.proof}`);

        // Check if we have requested a chain proof, reject unsolicited ones.
        // FIXME
        if (!this._requestedChainProof) {
            Log.w(NanoConsensusAgent, `Unsolicited chain proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }
        this._requestedChainProof = false;

        if (this._syncing) {
            this.fire('verify-chain-proof', this._peer.peerAddress);
        }

        // Push the proof into the NanoChain.
        if (!(await this._blockchain.pushProof(msg.proof))) {
            Log.w(NanoConsensusAgent, `Invalid chain proof received from ${this._peer.peerAddress} - verification failed`);
            // TODO ban instead?
            this._peer.channel.close('invalid chain proof');
            return;
        }

        // TODO add all blocks from the chain proof to knownObjects.

        // Apply any orphaned blocks we received while waiting for the chain proof.
        await this._applyOrphanedBlocks();

        if (this._syncing) {
            this._syncFinished();
        }
    }

    /**
     * @returns {Promise.<void>}
     * @private
     */
    async _applyOrphanedBlocks() {
        for (const header of this._orphanedBlocks) {
            const status = await this._blockchain.pushHeader(header);
            if (status === NanoChain.ERR_INVALID) {
                this._peer.channel.ban('received invalid block');
                break;
            }
        }
        this._orphanedBlocks = [];
    }

    /**
     * @param {Array.<InvVector>} vectors
     * @returns {void}
     * @protected
     * @override
     */
    _doRequestData(vectors) {
        /** @type {Array.<InvVector>} */
        const blocks = [];
        /** @type {Array.<InvVector>} */
        const transactions = [];
        for (const vector of vectors) {
            if (vector.type === InvVector.Type.BLOCK) {
                blocks.push(vector);
            } else {
                transactions.push(vector);
            }
        }

        // Request headers and transactions from peer.
        this._peer.channel.getHeader(blocks);
        this._peer.channel.getData(transactions);
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
     * @returns {Promise.<?Block>}
     * @protected
     * @override
     */
    _getBlock(hash, includeForks = false) {
        return this._blockchain.getBlock(hash, includeForks);
    }

    /**
     * @param {Hash} hash
     * @returns {Promise.<?Transaction>}
     * @protected
     * @override
     */
    _getTransaction(hash) {
        return Promise.resolve(this._mempool.getTransaction(hash));
    }

    /**
     * @param {Hash} hash
     * @param {BlockHeader} header
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processHeader(hash, header) {
        // TODO send reject message if we don't like the block
        const status = await this._blockchain.pushHeader(header);
        if (status === NanoChain.ERR_INVALID) {
            this._peer.channel.ban('received invalid header');
        }
        // Re-sync with this peer if it starts sending orphan blocks after the initial sync.
        else if (status === NanoChain.ERR_ORPHAN) {
            this._orphanedBlocks.push(header);
            if (this._synced) {
                this._requestChainProof();
            }
        }
    }

    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    _processTransaction(hash, transaction) {
        if (!this._localSubscription.matchesTransaction(transaction)) {
            this._peer.channel.ban('received transaction not matching our subscription');
        }
        return this._mempool.pushTransaction(transaction);
    }

    /**
     * @param {GetChainProofMessage} msg
     * @private
     */
    async _onGetChainProof(msg) {
        const proof = await this._blockchain.getChainProof();
        if (proof) {
            this._peer.channel.chainProof(proof);
        }
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array.<Account>>}
     */
    getAccounts(blockHash, addresses) {
        return this._synchronizer.push(() => {
            return this._getAccounts(blockHash, addresses);
        });
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array<Account>>}
     * @private
     */
    _getAccounts(blockHash, addresses) {
        Assert.that(this._accountsRequest === null);

        Log.d(NanoConsensusAgent, `Requesting AccountsProof for ${addresses} from ${this._peer.peerAddress}`);

        return new Promise((resolve, reject) => {
            this._accountsRequest = {
                addresses: addresses,
                blockHash: blockHash,
                resolve: resolve,
                reject: reject
            };

            // Request AccountsProof from peer.
            this._peer.channel.getAccountsProof(blockHash, addresses);

            // Drop the peer if it doesn't send the accounts proof within the timeout.
            this._peer.channel.expectMessage(Message.Type.ACCOUNTS_PROOF, () => {
                this._peer.channel.close('getAccountsProof timeout');
                reject(new Error('timeout')); // TODO error handling
            }, NanoConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {AccountsProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onAccountsProof(msg) {
        Log.d(NanoConsensusAgent, `[ACCOUNTS-PROOF] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.proof} (${msg.serializedSize} bytes)`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(NanoConsensusAgent, `Unsolicited accounts proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        const addresses = this._accountsRequest.addresses;
        const blockHash = this._accountsRequest.blockHash;
        const resolve = this._accountsRequest.resolve;
        const reject = this._accountsRequest.reject;

        // Reset accountsRequest.
        this._accountsRequest = null;

        if (!msg.hasProof()) {
            reject(new Error('Accounts request was rejected'));
            return;
        }

        // Check that the reference block corresponds to the one we requested.
        if (!blockHash.equals(msg.blockHash)) {
            Log.w(NanoConsensusAgent, `Received AccountsProof for invalid reference block from ${this._peer.peerAddress}`);
            reject(new Error('Invalid reference block'));
            return;
        }

        // Verify the proof.
        const proof = msg.proof;
        if (!proof.verify()) {
            Log.w(NanoConsensusAgent, `Invalid AccountsProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('Invalid AccountsProof');
            reject(new Error('Invalid AccountsProof'));
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = proof.root();
        const block = await this._blockchain.getBlock(blockHash);
        if (!block.accountsHash.equals(rootHash)) {
            Log.w(NanoConsensusAgent, `Invalid AccountsProof (root hash) received from ${this._peer.peerAddress}`);
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
                Log.w(NanoConsensusAgent, `Incomplete AccountsProof received from ${this._peer.peerAddress}`);
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
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array.<Transaction>>}
     */
    getTransactionsProof(blockHash, addresses) {
        return this._synchronizer.push(() => {
            return this._getTransactionsProof(blockHash, addresses);
        });
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array<Transaction>>}
     * @private
     */
    async _getTransactionsProof(blockHash, addresses) {
        Assert.that(this._transactionsRequest === null);

        Log.d(NanoConsensusAgent, `Requesting TransactionsProof for ${addresses} from ${this._peer.peerAddress}`);

        /** @type {Block} */
        const block = await this._blockchain.getBlock(blockHash);
        if (!block) {
            Log.d(NanoConsensusAgent, `Requested block with hash ${blockHash} not found`);
            return [];
        }

        return new Promise((resolve, reject) => {
            this._transactionsRequest = {
                addresses: addresses,
                blockHash: blockHash,
                header: block.header,
                resolve: resolve,
                reject: reject
            };

            // Request AccountsProof from peer.
            this._peer.channel.getTransactionsProof(blockHash, addresses);

            // Drop the peer if it doesn't send the accounts proof within the timeout.
            this._peer.channel.expectMessage(Message.Type.TRANSACTIONS_PROOF, () => {
                this._peer.channel.close('getTransactionsProof timeout');
                reject(new Error('timeout')); // TODO error handling
            }, NanoConsensusAgent.TRANSACTIONSPROOF_REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {TransactionsProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onTransactionsProof(msg) {
        Log.d(NanoConsensusAgent, `[TRANSACTIONS-PROOF] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, transactions=${msg.transactions}, proof=${msg.proof} (${msg.serializedSize} bytes)`);

        // Check if we have requested a transactions proof, reject unsolicited ones.
        if (!this._transactionsRequest) {
            Log.w(NanoConsensusAgent, `Unsolicited transactions proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        const blockHash = this._transactionsRequest.blockHash;
        /** @type {BlockHeader} */
        const header = this._transactionsRequest.header;
        const resolve = this._transactionsRequest.resolve;
        const reject = this._transactionsRequest.reject;

        // Reset transactionsRequest.
        this._transactionsRequest = null;

        if (!msg.hasProof()) {
            Log.w(NanoConsensusAgent, `TransactionsProof request was rejected by ${this._peer.peerAddress}`);
            reject(new Error('TransactionsProof request was rejected'));
            return;
        }

        // Check that the reference block corresponds to the one we requested.
        if (!blockHash.equals(msg.blockHash)) {
            Log.w(NanoConsensusAgent, `Received TransactionsProof for invalid reference block from ${this._peer.peerAddress}`);
            reject(new Error('Invalid reference block'));
            return;
        }

        // Verify the proof.
        const proof = msg.proof;
        if (!header.bodyHash.equals(proof.root())) {
            Log.w(NanoConsensusAgent, `Invalid TransactionsProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('Invalid TransactionsProof');
            reject(new Error('Invalid TransactionsProof'));
            return;
        }

        // Return the retrieved transactions.
        resolve(proof.transactions);
    }

    /**
     * @param {Address} address
     */
    getTransactionReceipts(address) {
        this._peer.channel.getTransactionReceipts(address);
        this._requestedTransactionReceipts = true;

        this._peer.channel.expectMessage(Message.Type.TRANSACTION_RECEIPTS, () => {
            this._peer.channel.close('getTransactionReceipts timeout');
        }, NanoConsensusAgent.TRANSACTIONS_REQUEST_TIMEOUT);
    }

    /**
     * @param {TransactionReceiptsMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onTransactionReceipts(msg) {
        Log.d(NanoConsensusAgent, `[TRANSACTION-RECEIPTS] Received from ${this._peer.peerAddress}: ${msg.transactionReceipts.length}`);

        // Check if we have requested transaction receipts, reject unsolicited ones.
        if (!this._requestedTransactionReceipts) {
            Log.w(NanoConsensusAgent, `Unsolicited transaction receipts received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }
        this._requestedTransactionReceipts = false;

        this.fire('transaction-receipts', msg.transactionReceipts);
    }

    /**
     * @param {Hash} hash
     * @returns {Promise.<Block>}
     */
    getFullBlock(hash) {
        // TODO we can use a different synchronizer here, no need to synchronize with getAccounts().
        return this._synchronizer.push(() => {
            return this._getFullBlock(hash);
        });
    }

    /**
     * @param {Hash} hash
     * @returns {Promise.<Block>}
     * @private
     */
    _getFullBlock(hash) {
        Assert.that(this._blockRequest === null);

        Log.d(NanoConsensusAgent, `Requesting full block ${hash} from ${this._peer.peerAddress}`);

        return new Promise((resolve, reject) => {
            this._blockRequest = {
                hash: hash,
                resolve: resolve,
                reject: reject
            };

            // Request full block from peer.
            const vector = new InvVector(InvVector.Type.BLOCK, hash);
            this._peer.channel.getData([vector]);

            // Drop the peer if it doesn't send the block within the timeout.
            this._peer.channel.expectMessage([Message.Type.BLOCK, Message.Type.NOT_FOUND], () => {
                reject(new Error('timeout')); // TODO error handling
            }, BaseConsensusAgent.REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {BlockMessage} msg
     * @return {Promise.<void>}
     * @protected
     * @override
     */
    async _onBlock(msg) {
        // Ignore all block messages that we didn't request.
        if (!this._blockRequest) {
            Log.w(NanoConsensusAgent, `Unsolicited block message received from ${this._peer.peerAddress}, discarding`);
            // TODO close/ban?
            return;
        }

        const blockHash = this._blockRequest.hash;
        const resolve = this._blockRequest.resolve;
        const reject = this._blockRequest.reject;

        // Reset blockRequest.
        this._blockRequest = null;

        // Check if we asked for this specific block.
        const hash = msg.block.hash();
        if (!hash.equals(blockHash)) {
            Log.w(NanoConsensusAgent, `Unexpected block received from ${this._peer.peerAddress}, discarding`);
            // TODO close/ban?
            reject(new Error('Unexpected block'));
            return;
        }

        // Verify block.
        // TODO should we let the caller do that instead?
        if (!(await msg.block.verify(this._time))) {
            Log.w(NanoConsensusAgent, `Invalid block received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('Invalid block');
            reject(new Error('Invalid block'));
            return;
        }

        // Return the retrieved block.
        resolve(msg.block);
    }

    /**
     * @param {NotFoundMessage} msg
     * @returns {void}
     * @protected
     * @override
     */
    _onNotFound(msg) {
        // Check if this notfound message corresponds to our block request.
        if (this._blockRequest && msg.vectors.length === 1 && msg.vectors[0].hash.equals(this._blockRequest.hash)) {
            const reject = this._blockRequest.reject;
            this._blockRequest = null;

            reject(new Error('Block not found'));
        }

        super._onNotFound(msg);
    }

    /**
     * @returns {void}
     * @protected
     * @override
     */
    _onClose() {
        // Clear the synchronizer queue.
        this._synchronizer.clear();
        super._onClose();
    }
}
/**
 * Maximum time (ms) to wait for chain-proof after sending out get-chain-proof before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT = 1000 * 45;
/**
 * Maximum time (ms) to wait for between chain-proof chunks before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.CHAINPROOF_CHUNK_TIMEOUT = 1000 * 10;
/**
 * Maximum time (ms) to wait for accounts-proof after sending out get-accounts-proof before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT = 1000 * 5;
NanoConsensusAgent.TRANSACTIONSPROOF_REQUEST_TIMEOUT = 1000 * 10;
NanoConsensusAgent.TRANSACTIONS_REQUEST_TIMEOUT = 1000 * 15;
NanoConsensusAgent.SUBSCRIPTION_CHANGE_THROTTLE = 1000 * 2;
Class.register(NanoConsensusAgent);
