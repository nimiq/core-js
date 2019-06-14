class LightConsensus extends BaseConsensus {
    /**
     * @param {LightChain} blockchain
     * @param {Mempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);
        /** @type {LightChain} */
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
     * @param {Address} minerAddress
     * @param {Uint8Array} [extraData]
     * @returns {Promise.<Block>}
     */
    async getBlockTemplate(minerAddress, extraData) {
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
    async getAccounts(addresses) {
        return Promise.all(addresses.map(addr => this._blockchain.accounts.get(addr)));
    }

    /**
     * @param {Array.<Hash>} hashes
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getPendingTransactions(hashes) {
        return /** @type {Array.<Transaction>} */ hashes.map(hash => this._mempool.getTransaction(hash)).filter(tx => tx != null);
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getPendingTransactionsByAddress(address) {
        return this._mempool.getTransactionsByAddresses([address]);
    }

    /**
     * @param {Transaction} tx
     * @returns {Promise.<void>} TODO
     */
    async sendTransaction(tx) {
        const mempoolCode = await this._mempool.pushTransaction(tx);
        switch (mempoolCode) {
            case Mempool.ReturnCode.ACCEPTED: {
                // Wait for transaction relay
                const relayed = await new Promise((resolve) => {
                    let id;
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
        return new LightConsensusAgent(this._blockchain, this._mempool, this._network.time, peer, this._invRequestManager, this._subscription);
    }

    /**
     * @param {Peer} peer
     * @override
     */
    _onPeerJoined(peer) {
        const agent = super._onPeerJoined(peer);

        // Forward sync events.
        this.bubble(agent, 'sync-chain-proof', 'verify-chain-proof', 'sync-accounts-tree', 'verify-accounts-tree', 'sync-finalize');

        return agent;
    }

    /** @type {LightChain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {Mempool} */
    get mempool() {
        return this._mempool;
    }
}

Class.register(LightConsensus);
