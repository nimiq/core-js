/** @typedef {number} Handle */
/** @typedef {function(blockHash: Hash):?Promise} BlockListener */
/** @typedef {function(consensusState: Client.ConsensusState):?Promise} ConsensusChangedListener */
/** @typedef {function(blockHash: Hash, reason: string, revertedBlocks: Array.<Hash>, adoptedBlocks: Array.<Hash>):?Promise} HeadChangedListener */
/** @typedef {function(transaction: Client.TransactionDetails):?Promise} TransactionListener */

/** @class Client */
class Client {
    /**
     * @param {Client.Configuration|object} config
     * @param {Promise.<BaseConsensus>} [consensus]
     */
    constructor(config, consensus) {
        /**
         * @package
         * @type {Promise.<BaseConsensus>}
         */
        this._consensus = consensus || config.createConsensus();
        /** @type {Array.<{type: string, id: number}>} */
        this._consensusListenerIds = [];
        /** @type {Synchronizer} */
        this._consensusSynchronizer = new Synchronizer();
        /** @type {HashSet.<Address>} */
        this._subscribedAddresses = new HashSet();

        /** @type {Client.Configuration|object} */
        this._config = config;

        /** @type {HashMap.<Handle, ConsensusChangedListener>} */
        this._consensusChangedListeners = new HashMap();
        /** @type {HashMap.<Handle, BlockListener>} */
        this._blockListeners = new HashMap();
        /** @type {HashMap.<Handle, HeadChangedListener>} */
        this._headChangedListeners = new HashMap();
        /** @type {HashMap.<Handle, {listener: TransactionListener, addresses: HashSet.<Address>}>} */
        this._transactionListeners = new HashMap();
        /** @type {Handle} */
        this._listenerId = 0;

        /** @type {Client.ConsensusState} */
        this._consensusState = Client.ConsensusState.CONNECTING;
        /** @type {Hash} */
        this._headHash = null;
        /** @type {HashMap.<number, HashSet.<TransactionDetails>>} */
        this._transactionConfirmWaiting = new HashMap();
        /** @type {HashMap.<number, HashSet.<TransactionDetails>>} */
        this._transactionExpireWaiting = new HashMap();
        /** @type {Synchronizer} */
        this._transactionSynchronizer = new Synchronizer();

        this._network = new Client.Network(this);
        this._mempool = new Client.Mempool(this);

        this._consensusSynchronizer
            .push(() => this._setupConsensus().catch(Log.w.tag(Client)))
            .catch(Log.w.tag(Client));
    }

    /**
     * Resets the current consensus internal state
     * @returns {Promise<void>}
     */
    resetConsensus() {
        return this._consensusSynchronizer
            .push(() => this._replaceConsensus(this._config.createConsensus()));
    }

    /**
     * Must be invoked in synchronizer
     * @private
     */
    async _setupConsensus() {
        const consensus = await this._consensus;
        this._consensusOn(consensus, 'block', (blockHash) => this._onBlock(blockHash));
        this._consensusOn(consensus, 'established', () => this._onConsensusChanged(Client.ConsensusState.ESTABLISHED));
        this._consensusOn(consensus, 'waiting', () => this._onConsensusChanged(Client.ConsensusState.CONNECTING));
        this._consensusOn(consensus, 'syncing', () => this._onConsensusChanged(Client.ConsensusState.SYNCING));
        this._consensusOn(consensus, 'head-changed', (blockHash, reason, revertedBlocks, adoptedBlocks) => this._onHeadChanged(blockHash, reason, revertedBlocks, adoptedBlocks));
        this._consensusOn(consensus, 'transaction-added', (tx) => this._onPendingTransaction(tx));
        this._consensusOn(consensus, 'transaction-added', (tx) => this._mempool._onTransactionAdded(tx));
        this._consensusOn(consensus, 'transaction-removed', (tx) => this._mempool._onTransactionRemoved(tx));
        this._consensusOn(consensus, 'transaction-mined', (tx, block, blockNow) => this._onMinedTransaction(block, tx, blockNow));
        this._consensusOn(consensus, 'consensus-failed', () => this._onConsensusFailed());

        this._onConsensusChanged(consensus.established ? Client.ConsensusState.ESTABLISHED : Client.ConsensusState.CONNECTING);

        if (this._config.hasFeature(Client.Feature.PASSIVE)) {
            consensus.network.allowInboundConnections = true;
        } else {
            consensus.network.connect();
        }
    }

    /**
     *
     * @param {BaseConsensus} consensus
     * @param {string} type
     * @param {function} fn
     * @private
     */
    _consensusOn(consensus, type, fn) {
        this._consensusListenerIds.push({type, id: consensus.on(type, fn)});
    }

    /**
     * Must be invoked in synchronizer
     * @param {Promise.<BaseConsensus>} newConsensus
     * @private
     */
    async _replaceConsensus(newConsensus) {
        const oldConsensus = await this._consensus;

        for (const {type, id} of this._consensusListenerIds) {
            oldConsensus.off(type, id);
        }
        this._consensusListenerIds = [];

        this._consensus = newConsensus;
        const consensus = await this._consensus;
        oldConsensus.handoverTo(consensus);
        return this._setupConsensus();
    }

    /**
     * @param {Transaction|Client.TransactionDetails} tx
     * @private
     */
    _txExpiresAt(tx) {
        return tx.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW + this._config.requiredBlockConfirmations - 1;
    }

    /**
     * @param {Transaction} tx
     * @private
     */
    _txWaitForExpire(tx) {
        const set = this._transactionExpireWaiting.get(this._txExpiresAt(tx)) || new HashSet();
        set.add(tx);
        this._transactionExpireWaiting.put(this._txExpiresAt(tx), set);
    }

    /**
     * @param {Transaction} tx
     * @private
     */
    _txClearFromExpire(tx) {
        if (this._transactionExpireWaiting.contains(this._txExpiresAt(tx))) {
            const set = this._transactionExpireWaiting.get(this._txExpiresAt(tx));
            set.remove(tx);
            if (set.length === 0) this._transactionExpireWaiting.remove(this._txExpiresAt(tx));
        }
    }

    /**
     * @param {number} blockHeight
     * @returns {number}
     * @private
     */
    _txConfirmsAt(blockHeight) {
        return blockHeight + this._config.requiredBlockConfirmations - 1;
    }

    /**
     * @param {Transaction} tx
     * @param {number} blockHeight
     * @private
     */
    _txWaitForConfirm(tx, blockHeight) {
        const set = this._transactionConfirmWaiting.get(this._txConfirmsAt(blockHeight)) || new HashSet();
        set.add(tx);
        this._transactionConfirmWaiting.put(this._txConfirmsAt(blockHeight), set);
    }

    /**
     * @param {Transaction} tx
     * @private
     */
    _txClearFromConfirm(tx) {
        for (const [key, value] of this._transactionConfirmWaiting.entryIterator()) {
            if (value.contains(tx)) {
                value.remove(tx);
                if (value.length === 0) {
                    this._transactionConfirmWaiting.remove(key);
                    break;
                }
            }
        }
    }

    /**
     * @param {Hash} blockHash
     * @private
     */
    _onBlock(blockHash) {
        for (const listener of this._blockListeners.values()) {
            listener(blockHash);
        }
    }

    /**
     * @param {Client.ConsensusState} state
     * @private
     */
    _onConsensusChanged(state) {
        this._consensusSynchronizer.push(async () => {
            const consensus = await this._consensus;
            if (state === this._consensusState) return;

            if (consensus.established) {
                const oldSubscription = consensus.getSubscription();
                if (oldSubscription.type === Subscription.Type.ADDRESSES) {
                    consensus.subscribe(Subscription.fromAddresses(this._subscribedAddresses.values()));
                }
            }

            this._consensusState = state;
            for (const listener of this._consensusChangedListeners.values()) {
                try {
                    await listener(state);
                } catch (e) {
                    Log.e(Client, `Error in listener: ${e}`);
                }
            }

            if (consensus.established) {
                const headHash = await consensus.getHeadHash();
                if (headHash.equals(this._headHash)) return;
                this._headHash = headHash;

                for (const listener of this._headChangedListeners.values()) {
                    try {
                        await listener(headHash, 'established', [], [headHash]);
                    } catch (e) {
                        Log.e(Client, `Error in listener: ${e}`);
                    }
                }
            }
        }).catch(Log.e.tag(Client));
    }

    _onConsensusFailed() {
        this._consensusSynchronizer.push(async () => {
            const consensus = await this._consensus;
            if (consensus instanceof PicoConsensus) {
                // Upgrade pico consensus to nano consensus
                Log.w(Client, 'Pico consensus failed, automatically upgrading to nano consensus');
                const newConsensus = new NanoConsensus(await new NanoChain(consensus.network.time), consensus.mempool, consensus.network);
                await this._replaceConsensus(Promise.resolve(newConsensus));
            }
        }).catch(Log.e.tag(Client));
    }

    /**
     * @param {Hash} blockHash
     * @param {string} reason
     * @param {Array.<Block>} revertedBlocks
     * @param {Array.<Block>} adoptedBlocks
     * @private
     */
    async _onHeadChanged(blockHash, reason, revertedBlocks, adoptedBlocks) {
        this._consensusSynchronizer.push(async () => {
            // Process head-changed listeners.
            if (this._consensusState === Client.ConsensusState.ESTABLISHED && !blockHash.equals(this._headHash)) {
                this._headHash = blockHash;

                for (const listener of this._headChangedListeners.values()) {
                    try {
                        await listener(blockHash, reason, revertedBlocks.map(b => b.hash()), adoptedBlocks.map(b => b.hash()));
                    } catch (e) {
                        Log.e(Client, `Error in listener: ${e}`);
                    }
                }
            }

            // Process transaction listeners.
            if (this._transactionListeners.length > 0) {
                const revertedTxs = new HashSet();
                const adoptedTxs = new HashSet(a => a.tx instanceof Transaction ? a.tx.hash().hashCode() : a.hash().hashCode());

                const consensus = await this._consensus;

                // Gather reverted transactions
                for (const block of revertedBlocks) {
                    if (block.isFull() && !(consensus instanceof PicoConsensus)) {
                        revertedTxs.addAll(block.transactions);
                    }
                    const set = this._transactionConfirmWaiting.get(this._txConfirmsAt(block.height));
                    if (set) {
                        for (const tx of set.valueIterator()) {
                            revertedTxs.add(tx);
                        }
                        this._transactionConfirmWaiting.remove(this._txConfirmsAt(block.height));
                    }
                }

                // Gather applied transactions
                // Only for full blocks, nano/pico nodes will fire transaction mined events later independently
                for (const block of adoptedBlocks) {
                    if (block.isFull() && !(consensus instanceof PicoConsensus)) {
                        for (const tx of block.transactions) {
                            if (revertedTxs.contains(tx)) {
                                revertedTxs.remove(tx);
                            }
                            adoptedTxs.add({tx, block});
                        }
                    }
                }

                // Report all reverted transactions that weren't applied again as pending
                for (const tx of revertedTxs.valueIterator()) {
                    this._onPendingTransaction(tx, adoptedBlocks[adoptedBlocks.length - 1]);
                }

                // Report confirmed transactions
                for (const block of adoptedBlocks) {
                    const set = this._transactionConfirmWaiting.get(block.height);
                    if (set) {
                        for (const tx of set.valueIterator()) {
                            this._onConfirmedTransaction(block, tx, adoptedBlocks[adoptedBlocks.length - 1]);
                        }
                        this._transactionConfirmWaiting.remove(block.height);
                    }
                }

                // Report newly applied transactions
                for (const {tx, block} of adoptedTxs.valueIterator()) {
                    this._onMinedTransaction(block, tx, adoptedBlocks[adoptedBlocks.length - 1]);
                }

                // Report expired transactions
                for (const block of adoptedBlocks) {
                    const set = this._transactionExpireWaiting.get(block.height);
                    if (set) {
                        for (const tx of set.valueIterator()) {
                            this._onExpiredTransaction(block, tx);
                        }
                        this._transactionExpireWaiting.remove(block.height);
                    }
                }
            }
        }).catch(Log.e.tag(Client));
    }

    /**
     * @param {Transaction} tx
     * @param {Block} [blockNow]
     * @private
     */
    _onPendingTransaction(tx, blockNow) {
        let details;
        let fs = [];
        for (const {listener, addresses} of this._transactionListeners.values()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                if (blockNow && blockNow.height >= this._txExpiresAt(tx)) {
                    details = details || new Client.TransactionDetails(tx, Client.TransactionState.EXPIRED);
                } else {
                    details = details || new Client.TransactionDetails(tx, Client.TransactionState.PENDING);
                }
                fs.push(async () => {
                    try {
                        await listener(details);
                    } catch (e) {
                        Log.e(Client, `Error in listener: ${e}`);
                    }
                });
            }
        }
        this._txClearFromConfirm(tx);
        if (details && details.state === Client.TransactionState.PENDING) {
            this._txWaitForExpire(tx);
        }
        if (fs.length > 0) {
            this._transactionSynchronizer.push(() => fs.forEach(f => f())).catch(Log.e.tag(Client));
        }
    }

    /**
     * @param {Block} block
     * @param {Transaction} tx
     * @param {Block} [blockNow]
     * @private
     */
    _onMinedTransaction(block, tx, blockNow) {
        let details;
        let fs = [];
        for (const {listener, addresses} of this._transactionListeners.values()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                let state = Client.TransactionState.MINED, confirmations = 1;
                if (blockNow) {
                    confirmations = (blockNow.height - block.height) + 1;
                    state = confirmations >= this._config.requiredBlockConfirmations ? Client.TransactionState.CONFIRMED : Client.TransactionState.MINED;
                }
                details = details || new Client.TransactionDetails(tx, state, block.hash(), block.height, confirmations, block.timestamp);
                fs.push(async () => {
                    try {
                        await listener(details);
                    } catch (e) {
                        Log.e(Client, `Error in listener: ${e}`);
                    }
                });
            }
        }
        this._txClearFromExpire(tx);
        if (details && details.state === Client.TransactionState.MINED) {
            this._txWaitForConfirm(tx, block.height);
        }
        if (fs.length > 0) {
            this._transactionSynchronizer.push(() => fs.forEach(f => f())).catch(Log.e.tag(Client));
        }
    }

    /**
     * @param {Block} block
     * @param {Transaction} tx
     * @param {Block} blockNow
     * @private
     */
    _onConfirmedTransaction(block, tx, blockNow) {
        let details;
        let fs = [];
        for (const {listener, addresses} of this._transactionListeners.values()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                details = details || new Client.TransactionDetails(tx, Client.TransactionState.CONFIRMED, block.hash(), block.height, (blockNow.height - block.height) + this._config.requiredBlockConfirmations, block.timestamp);
                fs.push(async () => {
                    try {
                        await listener(details);
                    } catch (e) {
                        Log.e(Client, `Error in listener: ${e}`);
                    }
                });
            }
        }
        if (fs.length > 0) {
            this._transactionSynchronizer.push(() => fs.forEach(f => f())).catch(Log.e.tag(Client));
        }
    }

    /**
     * @param {Block} block
     * @param {Transaction} tx
     * @private
     */
    _onExpiredTransaction(block, tx) {
        let details;
        let fs = [];
        for (const {listener, addresses} of this._transactionListeners.values()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                details = details || new Client.TransactionDetails(tx, Client.TransactionState.EXPIRED);
                fs.push(async () => {
                    try {
                        await listener(details);
                    } catch (e) {
                        Log.e(Client, `Error in listener: ${e}`);
                    }
                });
            }
        }
        if (fs.length > 0) {
            this._transactionSynchronizer.push(() => fs.forEach(f => f())).catch(Log.e.tag(Client));
        }
    }

    /**
     * Fetches the hash of the current tip of the chain.
     *
     * Data returned by this method authenticated according to the current tip of the blockchain. Any further changes to
     * as well as forks of the blockchain might invalidate the data.
     * @returns {Promise.<Hash>} Hash of the current tip of the chain
     */
    async getHeadHash() {
        const consensus = await this._consensus;
        return consensus.getHeadHash();
    }

    /**
     * Fetches the height or block number of the current tip of the chain.
     *
     * Data returned by this method authenticated according to the current tip of the blockchain. Any further changes to
     * as well as forks of the blockchain might invalidate the data.
     *
     * @returns {Promise.<number>} The height or block number of the current tip of the chain.
     */
    async getHeadHeight() {
        const consensus = await this._consensus;
        return consensus.getHeadHeight();
    }

    /**
     * Fetches the block that is the current tip of the chain.
     *
     * Data returned by this method authenticated according to the current tip of the blockchain. Any further changes to
     * as well as forks of the blockchain might invalidate the data.
     *
     * @param {boolean} [includeBody = true] Whether to include the transactions and other details of the block. If the
     *                                       client is not able to do so, it will return a block without such data.
     * @returns {Promise.<Block>} The block that is the current tip of the chain
     */
    async getHeadBlock(includeBody = true) {
        const consensus = await this._consensus;
        const hash = await consensus.getHeadHash();
        return consensus.getBlock(hash, includeBody);
    }

    /**
     * Fetches the block with the specified hash. Depending on your client configuration, this might include blocks
     * that do not exist on the current chain but are present on forks.
     *
     * @param {Hash|string} hash The hash of a block
     * @param {boolean} [includeBody = true] Whether to include the transactions and other details of the block. If the
     *                                       client is not able to do so, it will return a block without such data.
     * @returns {Promise.<Block>} The block with the specified hash. Throws an error if the block cannot be retrieved or
     *                            no block with the specified hash exists.
     */
    async getBlock(hash, includeBody = true) {
        hash = Hash.fromAny(hash);

        const consensus = await this._consensus;
        return consensus.getBlock(hash, includeBody);
    }

    /**
     * Fetches the block at the specified height or block number.
     *
     * Data returned by this method authenticated according to the current tip of the blockchain. Any further forks of
     * the blockchain might invalidate the data.
     *
     * @param {number} height The height or block number of the block to fetch
     * @param {boolean} [includeBody = true] Whether to include the transactions and other details of the block. If the
     *                                       client is not able to do so, it will return a block without such data.
     * @returns {Promise.<Block>} The block at the specified height or block number. Throws an error if the block cannot
     *                            be retrieved or no block at the specified height exists.
     */
    async getBlockAt(height, includeBody) {
        const consensus = await this._consensus;
        return consensus.getBlockAt(height, includeBody);
    }

    /**
     * Creates a template for the next block to be generated. This can be used to mine further blocks on top of the
     * current chain.
     *
     * Note that this functionality might not be available depending on your client configuration.
     *
     * @param {Address|string} minerAddress Address that will be rewarded for mining the block.
     * @param {Uint8Array|string} [extraData] Optional extra data to be embedded in the block.
     * @returns {Promise.<Block>} Template for the next block to be generated
     */
    async getBlockTemplate(minerAddress, extraData) {
        this._config.requireFeatures(Client.Feature.MINING, Client.Feature.MEMPOOL);
        minerAddress = Address.fromAny(minerAddress);

        if (typeof extraData === 'string') {
            extraData = BufferUtils.fromHex(extraData);
        } else if (extraData && !(extraData instanceof Uint8Array)) {
            throw new Error('Invalid extra data');
        }

        const consensus = await this._consensus;
        return consensus.getBlockTemplate(minerAddress, extraData);
    }

    /**
     * Submits a block to the blockchain.
     *
     * Note that this functionality might not be available depending on your client configuration.
     *
     * @param {Block|string} block The block to append to the blockchain.
     * @returns {Promise.<boolean>}
     */
    async submitBlock(block) {
        this._config.requireFeatures(Client.Feature.MINING);
        block = Block.fromAny(block);

        const consensus = await this._consensus;
        return consensus.submitBlock(block);
    }

    /**
     * Fetches a single account and its associated data by its address.
     *
     * Data returned by this method authenticated according to the current tip of the blockchain. Any further changes to
     * as well as forks of the blockchain might invalidate the data. To ensure up-to-date information, subscribe to head
     * changes (via {@link #addHeadChangedListener}) and refetch the account details.
     *
     * @param {Address|string} address Address of an account
     * @returns {Promise.<Account>} Single account and its associated data
     */
    async getAccount(address) {
        return (await this.getAccounts([address]))[0];
    }

    /**
     * Fetches multiple accounts and their associated data by their addresses.
     *
     * Data returned by this method authenticated according to the current tip of the blockchain. Any further changes to
     * as well as forks of the blockchain might invalidate the data. To ensure up-to-date information, subscribe to head
     * changes (via {@link #addHeadChangedListener}) and refetch the account details.
     *
     * @param {Array.<Address|string>} addresses List of addresses of accounts
     * @returns {Promise.<Array.<Account>>} List of accounts and their associated data
     */
    async getAccounts(addresses) {
        addresses = addresses.map(a => Address.fromAny(a));

        const consensus = await this._consensus;
        return consensus.getAccounts(addresses);
    }

    /**
     * Fetches a single transaction by its transaction hash. This method can be used to fetch transactions that
     * have been mined as well as pending transactions.
     *
     * If you happen to know the hash and height of the block that contained the transaction, for example from a
     * transaction receipt fetched earlier, you can provide such details to speed up the process of verification.
     *
     * Data returned by this method is authenticated. Note that transactions with the state
     * {@link Client.TransactionState.MINED} may be reverted as the chain is forked. Transactions with state
     * {@link Client.TransactionState.CONFIRMED} are considered confirmed according to the configuration provided
     * during client initialization.
     *
     * @param {Hash|string} hash Hash of a transaction
     * @param {Hash|string} [blockHash] The hash of the block containing that transaction
     * @param {number} [blockHeight] The height of the block containing that transaction
     * @returns {Promise.<TransactionDetails>} Details about the requested transaction. Throws an error if the no such
     *                                         transaction exists.
     */
    async getTransaction(hash, blockHash, blockHeight) {
        hash = Hash.fromAny(hash);
        if (blockHash) blockHash = Hash.fromAny(blockHash);

        const consensus = await this._consensus;

        if (!blockHash) {
            const receipts = await consensus.getTransactionReceiptsByHashes([hash]);
            if (receipts && receipts.length === 1 && receipts[0]) {
                blockHash = receipts[0].blockHash;
                blockHeight = receipts[0].blockHeight;
            }
        }

        if (!blockHash) {
            const pending = await consensus.getPendingTransactions([hash]);
            if (pending && pending[0]) {
                this._txWaitForExpire(pending[0]);
                return new Client.TransactionDetails(pending[0], Client.TransactionState.PENDING);
            } else {
                throw new Error('Unknown transaction hash');
            }
        }

        const block = await consensus.getBlock(blockHash, false, true, blockHeight);
        if (block) {
            blockHeight = block.height;
        } else {
            throw new Error('Unknown block hash');
        }

        const txs = await consensus.getTransactionsFromBlock([hash], blockHash, blockHeight, block);
        if (txs && txs[0]) {
            const tx = txs[0];
            const height = await consensus.getHeadHeight();
            const confirmations = (height - blockHeight) + 1;
            const confirmed = confirmations >= this._config.requiredBlockConfirmations;
            if (!confirmed) this._txWaitForConfirm(tx, blockHeight);
            return new Client.TransactionDetails(tx, confirmed ? Client.TransactionState.CONFIRMED : Client.TransactionState.MINED, blockHash, blockHeight, confirmations, block.timestamp);
        }

        throw new Error('Unknown transaction hash');
    }

    /**
     * Fetches a single transaction receipt by its transaction hash.
     *
     * Note that transaction receipts might be unauthenticated data depending on your client configuration and should
     * not necessarily be considered a confirmation that a transaction was actually mined in a block.
     *
     * @param {Hash|string} hash Hash of a transaction
     * @returns {Promise.<?TransactionReceipt>}
     */
    async getTransactionReceipt(hash) {
        hash = Hash.fromAny(hash);

        return (await this.getTransactionReceiptsByHashes([hash]))[0];
    }

    /**
     * Fetches transaction history as receipts for a single address.
     *
     * Note that transaction receipts might be unauthenticated data depending on your client configuration and should
     * not necessarily be considered a confirmation that a transaction was actually mined in a block.
     *
     * @param {Address|string} address Address of an account
     * @param {number} [limit=Infinity] Maximum number of receipts to return, may be exceeded depending on your client configuration.
     * @returns {Promise.<Array.<TransactionReceipt>>}
     */
    async getTransactionReceiptsByAddress(address, limit = Infinity) {
        address = Address.fromAny(address);

        const consensus = await this._consensus;
        return consensus.getTransactionReceiptsByAddress(address, limit);
    }

    /**
     * Fetches multiple transaction receipts by their transaction hash.
     *
     * Note that transaction receipts might be unauthenticated data depending on your client configuration and should
     * not necessarily be considered a confirmation that a transaction was actually mined in a block.
     *
     * @param {Array.<Hash|string>} hashes List of hashes of transactions
     * @returns {Promise.<Array.<TransactionReceipt>>}
     */
    async getTransactionReceiptsByHashes(hashes) {
        hashes = hashes.map(hash => Hash.fromAny(hash));

        const consensus = await this._consensus;
        return consensus.getTransactionReceiptsByHashes(hashes);
    }

    /**
     * This method can be used to fetch the transaction history for a specific address as well as any pending
     * transactions related to it.
     *
     * If you already fetched the transaction history before, you can provide some of this information.
     * - If you provide {@param sinceBlockHeight}, the logic assumes that you already know all transactions up to that
     *   state and are completely certain about its status. This should not be the last known block height, but a lower
     *   value that could not have been forked from (i.e. this should be lower than last known block height - required
     *   block confirmations, as else you would not be informed about transactions being confirmed)
     * - If you are aware of transactions that happened since {@param sinceBlockHeight} or were pending before you can
     *   provide them as well. This ensures you receive an update on them even with misbehaving peers. Pending
     *   transactions that appear to not have been mined will be stored in the local mempool and send to peers to
     *   ensure they are aware as well.
     *
     * Data returned by this method is authenticated. Note that transactions with the state
     * {@link Client.TransactionState.MINED} may be reverted as the chain is forked. Transactions with state
     * {@link Client.TransactionState.CONFIRMED} are considered confirmed according to the configuration provided
     * during client initialization.
     *
     * @param {Address|string} address Address of an account
     * @param {number} [sinceBlockHeight=0] Minimum block height to consider for updates
     * @param {Array.<Client.TransactionDetails>} [knownTransactionDetails] List of transaction details on already known transactions since {@param sinceBlockHeight}
     * @param {number} [limit=Infinity] Maximum number of transactions to return, this number may be exceeded for large knownTransactionDetails sets.
     * @return {Promise.<Array.<Client.TransactionDetails>>}
     */
    async getTransactionsByAddress(address, sinceBlockHeight = 0, knownTransactionDetails, limit = Infinity) {
        address = Address.fromAny(address);
        const knownTxs = new HashMap();
        if (knownTransactionDetails) {
            knownTransactionDetails = knownTransactionDetails.map(tx => Client.TransactionDetails.fromPlain(tx));
            for (const receipt of knownTransactionDetails) {
                knownTxs.put(receipt.transactionHash, receipt);
            }
        }

        // Get pending transactions from local mempool.
        const consensus = await this._consensus;
        const txs = new HashSet((i) => i instanceof Hash ? i.hashCode() : i.transactionHash.hashCode());
        try {
            const pending = await consensus.getPendingTransactionsByAddress(address, limit);
            for (const tx of pending) {
                this._txWaitForExpire(tx);
                txs.add(new Client.TransactionDetails(tx, Client.TransactionState.PENDING));
            }
        } catch (e) {
            // Ignore
        }

        // Fetch transaction receipts.
        const receipts = new HashSet((receipt) => receipt.transactionHash.hashCode());
        if (txs.length < limit) receipts.addAll(await consensus.getTransactionReceiptsByAddress(address, limit - txs.length));

        /** @type {HashMap.<string, HashSet.<Hash>>} */
        const requestProofs = new HashMap();
        /** @type {HashMap.<string, number>} */
        const blockHeights = new HashMap();
        for (const receipt of receipts.valueIterator()) {
            // Skip known transactions that are already considered confirmed.
            const knownTx = knownTxs.get(receipt.transactionHash);
            if (knownTx && knownTx.state === Client.TransactionState.CONFIRMED && receipt.blockHash.equals(knownTx.blockHash)) {
                continue;
            }

            // Check all receipts that are newer than sinceBlockHeight.
            if (receipt.blockHeight >= sinceBlockHeight) {
                const pendingProofAtBlock = requestProofs.get(receipt.blockHash.toBase64()) || new HashSet();
                pendingProofAtBlock.add(receipt.transactionHash);
                requestProofs.put(receipt.blockHash.toBase64(), pendingProofAtBlock);
                blockHeights.put(receipt.blockHash.toBase64(), receipt.blockHeight);
            }
        }

        // Re-check known (mined or confirmed) transactions that are not contained in the receipts.
        for (const details of knownTxs.valueIterator()) {
            if ((details.state === Client.TransactionState.MINED || details.state === Client.TransactionState.CONFIRMED)
                && details.blockHeight >= sinceBlockHeight
                && !receipts.contains(details)) {

                const transactionsToProve = requestProofs.get(details.blockHash.toBase64()) || new HashSet();
                transactionsToProve.add(details.transactionHash);
                requestProofs.put(details.blockHash.toBase64(), transactionsToProve);
                blockHeights.put(details.blockHash.toBase64(), details.blockHeight);
            }
        }

        // Retrieve proofs for the transaction we want to check.
        const height = await consensus.getHeadHeight();
        for (const [blockHashBase64, /** @type {HashSet.<Hash>} */ transactionsToProve] of requestProofs.entryIterator()) {
            const blockHash = Hash.fromBase64(blockHashBase64);
            if (blockHash.equals(Hash.NULL)) {
                throw new Error(`Illegal request for ${blockHashBase64} vs ${blockHash}`);
            }

            const blockHeight = blockHeights.get(blockHashBase64);
            const block = await consensus.getBlock(blockHash, false, true, blockHeight);
            const moreTx = await consensus.getTransactionsFromBlock(transactionsToProve.values(), blockHash, blockHeight, block);
            const confirmations = (height - blockHeight) + 1;
            const confirmed = confirmations >= this._config.requiredBlockConfirmations;

            for (const tx of moreTx) {
                if (!confirmed) this._txWaitForConfirm(tx, blockHeight);
                txs.add(new Client.TransactionDetails(tx, confirmed ? Client.TransactionState.CONFIRMED : Client.TransactionState.MINED, blockHash, blockHeight, confirmations, block.timestamp));
            }
        }

        // Track known (new or pending) transactions
        for (const /** @type {Client.TransactionDetails} */ details of knownTxs.valueIterator()) {
            if ((details.state === Client.TransactionState.NEW || details.state === Client.TransactionState.PENDING)
                && !txs.contains(details)) {

                if (this._txExpiresAt(details) <= height) {
                    txs.add(new Client.TransactionDetails(details.transaction, Client.TransactionState.EXPIRED));
                } else {
                    // Add to mempool.
                    txs.add(await this.sendTransaction(details.transaction));
                }
            }
        }

        return txs.values();
    }

    /**
     * @param {Transaction|object|string} tx
     * @returns {Promise.<TransactionDetails>}
     */
    async sendTransaction(tx) {
        tx = Transaction.fromAny(tx);

        const consensus = await this._consensus;
        switch (await consensus.sendTransaction(tx)) {
            case BaseConsensus.SendTransactionResult.EXPIRED:
                return new Client.TransactionDetails(tx, Client.TransactionState.EXPIRED);
            case BaseConsensus.SendTransactionResult.INVALID:
                return new Client.TransactionDetails(tx, Client.TransactionState.INVALIDATED);
            case BaseConsensus.SendTransactionResult.KNOWN:
            case BaseConsensus.SendTransactionResult.RELAYED:
            case BaseConsensus.SendTransactionResult.PENDING_LOCAL:
                return new Client.TransactionDetails(tx, Client.TransactionState.PENDING);
            case BaseConsensus.SendTransactionResult.ALREADY_MINED:
                return this.getTransaction(tx.hash());
        }
        return new Client.TransactionDetails(tx, Client.TransactionState.NEW);
    }

    /**
     * @param {BlockListener} listener
     * @return {Promise.<Handle>}
     */
    async addBlockListener(listener) { // eslint-disable-line require-await
        const listenerId = this._listenerId++;
        this._blockListeners.put(listenerId, listener);
        return listenerId;
    }

    /**
     * @param {ConsensusChangedListener} listener
     * @return {Promise.<Handle>}
     */
    async addConsensusChangedListener(listener) { // eslint-disable-line require-await
        const listenerId = this._listenerId++;
        this._consensusChangedListeners.put(listenerId, listener);
        return listenerId;
    }

    /**
     * @param {HeadChangedListener} listener
     * @return {Promise.<Handle>}
     */
    async addHeadChangedListener(listener) { // eslint-disable-line require-await
        const listenerId = this._listenerId++;
        this._headChangedListeners.put(listenerId, listener);
        return listenerId;
    }

    /**
     * @param {TransactionListener} listener
     * @param {Array.<Address|string>} addresses
     * @return {Promise.<Handle>}
     */
    async addTransactionListener(listener, addresses) {
        addresses = addresses.map(addr => Address.fromAny(addr));
        const set = new HashSet();
        set.addAll(addresses);

        this._subscribedAddresses.addAll(set);
        await this._consensusSynchronizer.push(async () => {
            const consensus = await this._consensus;
            if (consensus.established) {
                const oldSubscription = consensus.getSubscription();
                if (oldSubscription.type === Subscription.Type.ADDRESSES) {
                    consensus.subscribe(Subscription.fromAddresses(this._subscribedAddresses.values()));
                }
            }
        });
        const listenerId = this._listenerId++;
        this._transactionListeners.put(listenerId, {listener, addresses: set});
        return listenerId;
    }

    /**
     * @param {Handle} handle
     * @returns {Promise}
     */
    async removeListener(handle) { // eslint-disable-line require-await
        this._blockListeners.remove(handle);
        this._consensusChangedListeners.remove(handle);
        this._headChangedListeners.remove(handle);
        this._transactionListeners.remove(handle);
        if (this._transactionListeners.length === 0) {
            this._transactionConfirmWaiting.clear();
            this._transactionExpireWaiting.clear();
        }
    }

    /**
     * @returns {Promise}
     */
    waitForConsensusEstablished() {
        return new Promise(resolve => {
            if (this._consensusState === Client.ConsensusState.ESTABLISHED) {
                resolve();
            } else {
                let handle;
                // eslint-disable-next-line prefer-const
                handle = this.addConsensusChangedListener(async state => {
                    if (state === Client.ConsensusState.ESTABLISHED) {
                        await this.removeListener(handle);
                        resolve();
                    }
                });
            }
        });
    }

    /**
     * Access and modify network information such as connected peers.
     * @type {Client.Network}
     */
    get network() {
        return this._network;
    }

    /**
     * Access the mempool directly. Allows for unfiltered processing of all transactions in the mempool.
     * @type {Client.Mempool}
     */
    get mempool() {
        this._config.requireFeatures(Client.Feature.MEMPOOL);
        return this._mempool;
    }
}

Client.ConsensusState = {
    /**
     * The client is connecting to the network
     */
    CONNECTING: 'connecting',
    /**
     * The client is syncing data from peers to reach consensus
     */
    SYNCING: 'syncing',
    /**
     * The client reached consensus with its peers
     */
    ESTABLISHED: 'established'
};

Class.register(Client);
