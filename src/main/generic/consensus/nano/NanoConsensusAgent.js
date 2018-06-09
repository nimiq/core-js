class NanoConsensusAgent extends BaseConsensusAgent {
    /**
     * @param {NanoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Time} time
     * @param {Peer} peer
     * @param {InvRequestManager} invRequestManager
     * @param {Subscription} targetSubscription
     */
    constructor(blockchain, mempool, time, peer, invRequestManager, targetSubscription) {
        super(time, peer, invRequestManager, targetSubscription);
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {NanoMempool} */
        this._mempool = mempool;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        /** @type {boolean} */
        this._syncing = false;

        /** @type {Array.<BlockHeader>} */
        this._orphanedBlocks = [];

        // Helper object to keep track of the accounts we're requesting from the peer.
        this._accountsRequest = null;

        // Flag to track chain proof requests.
        this._requestedChainProof = false;

        // Listen to consensus messages from the peer.
        peer.channel.on('chain-proof', msg => this._onChainProof(msg));
        peer.channel.on('accounts-proof', msg => this._onAccountsProof(msg));

        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));

        // Subscribe to all announcements from the peer.
        this._subscribeTarget();
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

    requestMempool() {
        // Request the peer's mempool.
        // XXX Use a random delay here to prevent requests to multiple peers at once.
        const delay = NanoConsensusAgent.MEMPOOL_DELAY_MIN
            + Math.random() * (NanoConsensusAgent.MEMPOOL_DELAY_MAX - NanoConsensusAgent.MEMPOOL_DELAY_MIN);
        setTimeout(() => this._peer.channel.mempool(), delay);
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        this._syncing = false;
        this._synced = true;

        this.requestMempool();

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
            this._peer.channel.close(CloseType.GET_CHAIN_PROOF_TIMEOUT, 'getChainProof timeout');
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
            this._peer.channel.close(CloseType.INVALID_CHAIN_PROOF, 'invalid chain proof');
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
                this._peer.channel.close(CloseType.RECEIVED_INVALID_BLOCK, 'received invalid block');
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
     * @returns {?Transaction}
     * @protected
     * @override
     */
    _getTransaction(hash) {
        return this._mempool.getTransaction(hash);
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
            this._peer.channel.close(CloseType.RECEIVED_INVALID_HEADER, 'received invalid header');
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
        return this._synchronizer.push('getAccounts',
            this._getAccounts.bind(this, blockHash, addresses));
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
                this._peer.channel.close(CloseType.GET_ACCOUNTS_PROOF_TIMEOUT, 'getAccountsProof timeout');
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
            this._peer.channel.close(CloseType.INVALID_ACCOUNTS_PROOF, 'Invalid AccountsProof');
            reject(new Error('Invalid AccountsProof'));
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = proof.root();
        const block = await this._blockchain.getBlock(blockHash);
        if (!block.accountsHash.equals(rootHash)) {
            Log.w(NanoConsensusAgent, `Invalid AccountsProof (root hash) received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close(CloseType.ACCOUNTS_PROOF_ROOT_HASH_MISMATCH, 'AccountsProof root hash mismatch');
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
                this._peer.channel.close(CloseType.INCOMPLETE_ACCOUNTS_PROOF, 'Incomplete AccountsProof');
                reject(new Error('Incomplete AccountsProof'));
                return;
            }
        }

        // Return the retrieved accounts.
        resolve(accounts);
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

    /** @type {boolean} */
    get syncing() {
        return this._syncing;
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
/**
 * Minimum time {ms} to wait before triggering the initial mempool request.
 * @type {number}
 */
NanoConsensusAgent.MEMPOOL_DELAY_MIN = 1000 * 2; // 2 seconds
/**
 * Maximum time {ms} to wait before triggering the initial mempool request.
 * @type {number}
 */
NanoConsensusAgent.MEMPOOL_DELAY_MAX = 1000 * 20; // 20 seconds
Class.register(NanoConsensusAgent);
