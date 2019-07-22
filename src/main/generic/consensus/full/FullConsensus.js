class FullConsensus extends BaseConsensus {
    /**
     * @param {FullChain} blockchain
     * @param {Mempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);
        /** @type {FullChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {BlockProducer} */
        this._producer = new BlockProducer(blockchain, blockchain.accounts, mempool, network.time);
    }

    //
    // Public consensus interface
    //

    /**
     * @param {Hash} hash
     * @param {boolean} [includeBody = true]
     * @param {boolean} [includeBodyFromLocal]
     * @param {number} [blockHeight]
     * @returns {Promise.<Block>}
     * @override
     */
    getBlock(hash, includeBody = true, includeBodyFromLocal = includeBody, blockHeight) { // eslint-disable-line no-unused-vars
        // Override to not fallback to network.
        const block = this._blockchain.getBlock(hash, true, includeBody);
        if (!block) {
            throw new Error(`No block found for hash ${hash}`);
        }
        return block;
    }

    /**
     * @param {number} height
     * @param {boolean} [includeBody = true]
     * @returns {Promise.<Block>}
     * @override
     */
    getBlockAt(height, includeBody = true) {
        // Override to not fallback to network.
        if (height > this._blockchain.height || height < 1) {
            throw new Error('Invalid height');
        }

        const block = this._blockchain.getBlockAt(height, includeBody);
        if (!block) {
            throw new Error(`No block found at height ${height}`);
        }
        return block;
    }

    /**
     * @param {Address} minerAddress
     * @param {Uint8Array} [extraData]
     * @returns {Promise.<Block>}
     */
    getBlockTemplate(minerAddress, extraData) {
        return this._producer.getNextBlock(minerAddress, extraData);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async submitBlock(block) {
        return (await this.blockchain.pushBlock(block)) >= 0;
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array.<Account>>}
     */
    getAccounts(addresses) {
        return Promise.all(addresses.map(addr => this._blockchain.accounts.get(addr)));
    }

    /**
     * @param {Array.<Hash>} hashes
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getPendingTransactions(hashes) { // eslint-disable-line require-await
        return /** @type {Array.<Transaction>} */ hashes.map(hash => this._mempool.getTransaction(hash)).filter(tx => tx != null);
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getPendingTransactionsByAddress(address, limit) { // eslint-disable-line require-await
        return this._mempool.getTransactionsByAddresses([address], limit);
    }

    /**
     * @param {Array.<Hash>} hashes
     * @param {Hash} blockHash
     * @param {number} [blockHeight]
     * @param {Block} [block]
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getTransactionsFromBlock(hashes, blockHash, blockHeight, block) {
        // Override to not fallback to network
        block = block && block.isFull() ? block : await this._blockchain.getBlock(blockHash, false, true);
        if (!block) {
            throw new Error(`No block found for hash ${blockHash}`);
        }
        return block.transactions.filter(tx => hashes.find(hash => hash.equals(tx.hash())));
    }

    /**
     * @param {Address} address
     * @param {number} limit
     * @returns {Promise.<Array.<TransactionReceipt>>}
     */
    getTransactionReceiptsByAddress(address, limit) {
        // XXX Assumes that blockchain supports transaction index.
        return this._blockchain.getTransactionReceiptsByAddress(address, limit);
    }

    /**
     * @param {Array.<Hash>} hashes
     * @returns {Promise.<Array.<TransactionReceipt>>}
     */
    getTransactionReceiptsByHashes(hashes) {
        // XXX Assumes that blockchain supports transaction index.
        return this._blockchain.getTransactionReceiptsByHashes(hashes);
    }

    /**
     * @param {Transaction} tx
     * @returns {Promise.<BaseConsensus.SendTransactionResult>}
     */
    async sendTransaction(tx) {
        const mempoolCode = await this._mempool.pushTransaction(tx);
        switch (mempoolCode) {
            case Mempool.ReturnCode.ACCEPTED: {
                // Wait for transaction relay
                const relayed = await new Promise((resolve) => {
                    let id;
                    // eslint-disable-next-line prefer-const
                    id = this.on('transaction-relayed', relayedTx => {
                        if (relayedTx.equals(tx)) {
                            this.off('transaction-relayed', id);
                            resolve(true);
                        }
                    });
                    setTimeout(() => {
                        this.off('transaction-relayed', id);
                        resolve(false);
                    }, BaseConsensus.TRANSACTION_RELAY_TIMEOUT);
                });
                if (relayed) {
                    return BaseConsensus.SendTransactionResult.RELAYED;
                } else {
                    return BaseConsensus.SendTransactionResult.PENDING_LOCAL;
                }
            }
            case Mempool.ReturnCode.KNOWN:
                return BaseConsensus.SendTransactionResult.KNOWN;
            case Mempool.ReturnCode.FEE_TOO_LOW:
            case Mempool.ReturnCode.FILTERED:
                return BaseConsensus.SendTransactionResult.REJECTED_LOCAL;
            case Mempool.ReturnCode.MINED:
                return BaseConsensus.SendTransactionResult.ALREADY_MINED;
            case Mempool.ReturnCode.EXPIRED:
                return BaseConsensus.SendTransactionResult.EXPIRED;
            case Mempool.ReturnCode.INVALID:
                return BaseConsensus.SendTransactionResult.INVALID;
        }
        return BaseConsensus.SendTransactionResult.NONE;
    }

    /**
     * @returns {Array.<Transaction>}
     */
    getMempoolContents() {
        return this._mempool.getTransactions();
    }

    //
    //

    /**
     * @param {number} minFeePerByte
     */
    subscribeMinFeePerByte(minFeePerByte) {
        this.subscribe(Subscription.fromMinFeePerByte(minFeePerByte));
        this.mempool.evictBelowMinFeePerByte(minFeePerByte);
    }

    /**
     * @type {number} minFeePerByte
     */
    get minFeePerByte() {
        return this._subscription.type === Subscription.Type.MIN_FEE ? this._subscription.minFeePerByte : 0;
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @override
     */
    _newConsensusAgent(peer) {
        return new FullConsensusAgent(this._blockchain, this._mempool, this._network.time, peer, this._invRequestManager, this._subscription);
    }

    /** @type {FullChain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {Mempool} */
    get mempool() {
        return this._mempool;
    }
}

Class.register(FullConsensus);
