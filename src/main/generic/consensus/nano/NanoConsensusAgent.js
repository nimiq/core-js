class NanoConsensusAgent extends BaseConsensusAgent {
    /**
     * @param {NanoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Peer} peer
     */
    constructor(blockchain, mempool, peer) {
        super(peer);
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {NanoMempool} */
        this._mempool = mempool;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        /** @type {boolean} */
        this._syncing = false;

        // Flag indicating that have synced our blockchain with the peer's.
        /** @type {boolean} */
        this._synced = false;

        /** @type {Array.<BlockHeader>} */
        this._orphanedBlocks = [];

        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        // Helper object to keep track of the accounts we're requesting from the peer.
        this._accountsRequest = null;

        // Listen to consensus messages from the peer.
        peer.channel.on('chain-proof', msg => this._onChainProof(msg));
        peer.channel.on('accounts-proof', msg => this._onAccountsProof(msg));
        peer.channel.on('accounts-rejected', msg => this._onAccountsRejected(msg));

        peer.channel.on('get-chain-proof', msg => this._onGetChainProof(msg));

        // Subscribe to all announcements from the peer.
        this._peer.channel.subscribe(Subscription.ANY);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @override
     */
    relayBlock(block) {
        // Don't relay if no consensus established yet.
        if (!this._synced) return Promise.resolve();
        return super.relayBlock(block);
    }

    /**
     * @returns {Promise.<void>}
     */
    async syncBlockchain() {
        this._syncing = true;

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
        if (this._timers.timeoutExists('getChainProof')) {
            return;
        }

        // Request ChainProof from peer.
        this._peer.channel.getChainProof();

        // Drop the peer if it doesn't send the chain proof within the timeout.
        // TODO should we ban here instead?
        this._timers.setTimeout('getChainProof', () => {
            this._peer.channel.close('getChainProof timeout');
        }, NanoConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT);
    }

    /**
     * @param {ChainProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onChainProof(msg) {
        Log.d(NanoConsensusAgent, `[CHAIN-PROOF] Received from ${this._peer.peerAddress}: ${msg.proof} (${msg.proof.serializedSize} bytes)`);

        // Check if we have requested an interlink chain, reject unsolicited ones.
        if (!this._timers.timeoutExists('getChainProof')) {
            Log.w(NanoConsensusAgent, `Unsolicited chain proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear timeout.
        this._timers.clearTimeout('getChainProof');

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
     * @param {BlockMessage} msg
     * @return {Promise.<void>}
     * @protected
     * @override
     */
    _onBlock(msg) {
        // Ignore block messages.
        Log.w(NanoConsensusAgent, `Unsolicited block message received from ${this._peer.peerAddress}, discarding`);
    }

    /**
     * @param {BlockHeader} header
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processHeader(header) {
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
     * @param {Transaction} transaction
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    _processTransaction(transaction) {
        // TODO send reject message if we don't like the transaction
        return this._mempool.pushTransaction(transaction);
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
            this._timers.setTimeout('getAccountsProof', () => {
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
        Log.d(NanoConsensusAgent, `[ACCOUNTS-PROOF] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.proof}`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(NanoConsensusAgent, `Unsolicited accounts proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear the request timeout.
        this._timers.clearTimeout('getAccountsProof');

        const addresses = this._accountsRequest.addresses;
        const blockHash = this._accountsRequest.blockHash;
        const resolve = this._accountsRequest.resolve;
        const reject = this._accountsRequest.reject;

        // Reset accountsRequest.
        this._accountsRequest = null;

        // Check that we know the reference block.
        // TODO Which blocks should be accept here?
        // XXX For now, we ONLY accept our head block. This will not work well in face of block propagation delays.
        if (!blockHash.equals(msg.blockHash)) {
            Log.w(NanoConsensusAgent, `Received AccountsProof for block != head from ${this._peer.peerAddress}`);
            reject(new Error('Invalid reference block'));
            return;
        }

        // Verify the proof.
        const proof = msg.proof;
        if (!(await proof.verify())) {
            Log.w(NanoConsensusAgent, `Invalid AccountsProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close('Invalid AccountsProof');
            reject(new Error('Invalid AccountsProof'));
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = await proof.root();
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
     * @param {AccountsRejectedMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    _onAccountsRejected(msg) {
        Log.d(NanoConsensusAgent, `[ACCOUNTS-REJECTED] Received from ${this._peer.peerAddress}`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(NanoConsensusAgent, `Unsolicited accounts rejected received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        // Clear the request timeout.
        this._timers.clearTimeout('getAccountsProof');
        const reject = this._accountsRequest.reject;

        // Reset accountsRequest.
        this._accountsRequest = null;


        reject(new Error('Accounts request was rejected'));
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
     * @returns {void}
     * @protected
     * @override
     */
    _onClose() {
        // Clear the synchronizer queue.
        this._synchronizer.clear();
        super._onClose();
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
/**
 * Maximum time (ms) to wait for chainProof after sending out getChainProof before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.CHAINPROOF_REQUEST_TIMEOUT = 1000 * 10;
/**
 * Maximum time (ms) to wait for chainProof after sending out getChainProof before dropping the peer.
 * @type {number}
 */
NanoConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT = 1000 * 5;
Class.register(NanoConsensusAgent);
