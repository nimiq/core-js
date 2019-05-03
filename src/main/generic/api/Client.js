/** @typedef {number} Handle */
/** @typedef {function(blockHash: Hash):void} BlockListener */
/** @typedef {function(consensusState: Client.ConsensusState):void} ConsensusChangedListener */
/** @typedef {function(blockHash: Hash, reason: string, revertedBlocks: Array.<Hash>, adoptedBlocks: Array.<Hash>):void} HeadChangedListener */

/** @typedef {function(transaction: Client.TransactionDetails):void} TransactionListener */

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
        /** @type {HashMap.<number, HashSet<TransactionDetails>>} */
        this._transactionConfirmWaiting = new HashMap();
        /** @type {HashMap.<number, HashSet<TransactionDetails>>} */
        this._transactionExpireWaiting = new HashMap();

        this._network = new Client.Network(this);
        this._mempool = new Client.Mempool(this);

        this._consensusSynchronizer.push(() => this._setupConsensus().catch(Log.w.tag(Client))).catch(Log.w.tag(Client));
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
        this._consensusOn(consensus, 'lost', () => this._onConsensusChanged(Client.ConsensusState.SYNCING));
        this._consensusOn(consensus, 'head-changed', (blockHash, reason, revertedBlocks, adoptedBlocks) => this._onHeadChanged(blockHash, reason, revertedBlocks, adoptedBlocks));
        this._consensusOn(consensus, 'transaction-added', (tx) => this._onPendingTransaction(tx));
        this._consensusOn(consensus, 'transaction-added', (tx) => this._mempool._onTransactionAdded(tx));
        this._consensusOn(consensus, 'transaction-removed', (tx) => this._mempool._onTransactionRemoved(tx));
        consensus.network.connect();
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
        const consensus = await this._consensus;

        for (let {type, id} of this._consensusListenerIds) {
            consensus.off(type, id);
        }
        this._consensusListenerIds = [];

        this._consensus = newConsensus;
        await this._setupConsensus();
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
     * @param {Transaction }tx
     * @param {number} blockHeight
     * @returns {number}
     * @private
     */
    _txConfirmsAt(tx, blockHeight) {
        return blockHeight + this._config.requiredBlockConfirmations - 1;
    }

    /**
     * @param {Transaction} tx
     * @param {number} blockHeight
     * @private
     */
    _txWaitForConfirm(tx, blockHeight) {
        const set = this._transactionConfirmWaiting.get(this._txConfirmsAt(tx, blockHeight)) || new HashSet();
        set.add(tx);
        this._transactionConfirmWaiting.put(this._txConfirmsAt(tx, blockHeight), set);
    }

    /**
     * @param {Transaction} tx
     * @private
     */
    _txClearFromConfirm(tx) {
        for (let key of this._transactionConfirmWaiting.keyIterator()) {
            const value = this._transactionConfirmWaiting.get(key);
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
        for (let listener of this._blockListeners.valueIterator()) {
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
            if (consensus.established) {
                const oldSubscription = consensus.getSubscription();
                if (oldSubscription.type === Subscription.Type.ADDRESSES) {
                    consensus.subscribe(Subscription.fromAddresses(this._subscribedAddresses.values()));
                }
            }
        });
        this._consensusState = state;
        for (let listener of this._consensusChangedListeners.valueIterator()) {
            listener(state);
        }
    }

    /**
     * @param {Hash} blockHash
     * @param {string} reason
     * @param {Array.<Block>} revertedBlocks
     * @param {Array.<Block>} adoptedBlocks
     * @private
     */
    async _onHeadChanged(blockHash, reason, revertedBlocks, adoptedBlocks) {
        for (let listener of this._headChangedListeners.valueIterator()) {
            listener(blockHash, reason, revertedBlocks.map(b => b.hash()), adoptedBlocks.map(b => b.hash()));
        }
        if (this._transactionListeners.length > 0) {
            const revertedTxs = new HashSet();
            const adoptedTxs = new HashSet(a => a.tx instanceof Transaction ? a.tx.hash() : a.hash());
            for (let block of revertedBlocks) {
                revertedTxs.addAll(block.transactions);
                for (let tx of block.transactions) {
                    this._transactionConfirmWaiting.remove(this._txConfirmsAt(tx, block.height));
                }
            }
            for (let block of adoptedBlocks) {
                for (let tx of block.transactions) {
                    if (revertedTxs.contains(tx)) {
                        revertedTxs.remove(tx);
                    }
                    adoptedTxs.add({tx, block});
                }
            }
            for (let tx of revertedTxs.valueIterator()) {
                this._onPendingTransaction(tx, adoptedBlocks[adoptedBlocks.length - 1]);
            }
            for (let block of adoptedBlocks) {
                const set = this._transactionConfirmWaiting.get(block.height);
                if (set) {
                    for (let tx of set.valueIterator()) {
                        this._onConfirmedTransaction(block, tx, adoptedBlocks[adoptedBlocks.length - 1]);
                    }
                    this._transactionConfirmWaiting.remove(block.height);
                }
            }
            for (let {tx, block} of adoptedTxs.valueIterator()) {
                this._onMinedTransaction(block, tx, adoptedBlocks[adoptedBlocks.length - 1]);
            }
            for (let block of adoptedBlocks) {
                const set = this._transactionExpireWaiting.get(block.height);
                if (set) {
                    for (let tx of set.valueIterator()) {
                        this._onExpiredTransaction(block, tx);
                    }
                    this._transactionExpireWaiting.remove(block.height);
                }
            }
            if (this._consensusState === Client.ConsensusState.ESTABLISHED) {
                const consensus = await this._consensus;
                const addresses = this._subscribedAddresses.values();
                for (let block of adoptedBlocks) {
                    const txs = await consensus.getTransactionsFromBlockByAddresses(addresses, block.hash(), block.height);
                    for (let tx of txs) {
                        if (!adoptedTxs.contains(tx)) {
                            this._onMinedTransaction(block, tx, adoptedBlocks[adoptedBlocks.length - 1]);
                        }
                    }
                }
            }
        }
    }

    /**
     * @param {Transaction} tx
     * @param {Block} [blockNow]
     * @private
     */
    _onPendingTransaction(tx, blockNow) {
        let details;
        for (let {listener, addresses} of this._transactionListeners.valueIterator()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                if (blockNow && blockNow.height >= this._txExpiresAt(tx)) {
                    details = details || new Client.TransactionDetails(tx, Client.TransactionState.EXPIRED);
                } else {
                    details = details || new Client.TransactionDetails(tx, Client.TransactionState.PENDING);
                }
                listener(details);
            }
        }
        this._txClearFromConfirm(tx);
        if (details && details.state === Client.TransactionState.PENDING) {
            this._txWaitForExpire(tx);
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
        for (let {listener, addresses} of this._transactionListeners.valueIterator()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                let state = Client.TransactionState.MINED, confirmations = 1;
                if (blockNow) {
                    confirmations = (blockNow.height - block.height) + 1;
                    state = confirmations >= this._config.requiredBlockConfirmations ? Client.TransactionState.CONFIRMED : Client.TransactionState.MINED;
                }
                details = details || new Client.TransactionDetails(tx, state, block.hash(), block.height, confirmations);
                listener(details);
            }
        }
        this._txClearFromExpire(tx);
        if (details && details.state === Client.TransactionState.MINED) {
            this._txWaitForConfirm(tx, block.height);
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
        for (let {listener, addresses} of this._transactionListeners.valueIterator()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                details = details || new Client.TransactionDetails(tx, Client.TransactionState.CONFIRMED, block.hash(), block.height, (blockNow.height - block.height) + 1);
                listener(details);
            }
        }
    }

    /**
     * @param {Block} block
     * @param {Transaction} tx
     * @private
     */
    _onExpiredTransaction(block, tx) {
        let details;
        for (let {listener, addresses} of this._transactionListeners.valueIterator()) {
            if (addresses.contains(tx.sender) || addresses.contains(tx.recipient)) {
                details = details || new Client.TransactionDetails(tx, Client.TransactionState.EXPIRED);
                listener(details);
            }
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
     * @param {boolean} [includeBody = true] Whether to include the transactions and other details of the block
     * @returns {Promise.<Block>} The block that is the current tip of the chain
     */
    async getHeadBlock(includeBody = true) {
        const consensus = await this._consensus;
        let hash = await consensus.getHeadHash();
        return consensus.getBlock(hash, includeBody);
    }

    /**
     * Fetches the block with the specified hash. Depending on your client configuration, this might include blocks
     * that do not exist on the current chain but are present on forks.
     *
     * @param {Hash|string} hash The hash of a block
     * @param {boolean} [includeBody = true] Whether to include the transactions and other details of the block
     * @returns {Promise.<Block>} The block with the specified hash
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
     * @param {boolean} [includeBody = true] Whether to include the transactions and other details of the block
     * @returns {Promise.<Block>} The block at the specified height or block number
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
     * @returns {Promise.<number>}
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
     * @returns {Promise.<TransactionDetails>}
     */
    async getTransaction(hash, blockHash, blockHeight) {
        hash = Hash.fromAny(hash);
        if (blockHash) blockHash = Hash.fromAny(blockHash);

        const consensus = await this._consensus;

        if (!blockHash) {
            const receipts = await consensus.getTransactionReceiptsByHashes([hash]);
            if (receipts.length === 1 && receipts[0]) {
                blockHash = receipts[0].blockHash;
                blockHeight = receipts[0].blockHeight;
            }
        }

        if (blockHash && !blockHeight) {
            const block = await consensus.getBlock(blockHash, false);
            if (block) {
                blockHeight = block.height;
            } else {
                throw new Error('Block hash is invalid');
            }
        }

        if (blockHash) {
            const txs = await consensus.getTransactionsFromBlock([hash], blockHash, blockHeight);
            if (txs && txs[0]) {
                const tx = txs[0];
                const height = await consensus.getHeadHeight();
                const confirmations = (height - blockHeight) + 1;
                const confirmed = confirmations >= this._config.requiredBlockConfirmations;
                if (!confirmed) this._txWaitForConfirm(tx, blockHeight);
                return new Client.TransactionDetails(tx, confirmed ? Client.TransactionState.CONFIRMED : Client.TransactionState.MINED, blockHash, blockHeight, confirmations);
            }
        }

        const pending = await consensus.getPendingTransactions([hash]);
        if (pending && pending[0]) {
            this._txWaitForExpire(pending[0]);
            return new Client.TransactionDetails(pending[0], Client.TransactionState.PENDING);
        }
        return null;
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
     * @returns {Promise.<Array.<TransactionReceipt>>}
     */
    async getTransactionReceiptsByAddress(address) {
        address = Address.fromAny(address);

        const consensus = await this._consensus;
        return consensus.getTransactionReceiptsByAddress(address);
    }

    /**
     * Fetches multiple transaction receipts by their transaction hash.
     *
     * Note that transaction receipts might be unauthenticated data depending on your client configuration and should
     * not necessarily be considered a confirmation that a transaction was actually mined in a block.
     *
     * @param {Array.<Hash|string>} hashes List of hashes of transactions
     * @returns {Promise.<Array.<?TransactionReceipt>>}
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
     * @param {Address} address Address of an account
     * @param {number} [sinceBlockHeight=0] Minimum block height to consider for updates
     * @param {Array.<TransactionDetails>} [knownTransactionDetails] List of transaction details on already known transactions since {@param sinceBlockHeight}
     * @return {Promise.<Array.<TransactionDetails>>}
     */
    async getTransactionsByAddress(address, sinceBlockHeight = 0, knownTransactionDetails) {
        address = Address.fromAny(address);
        let knownTxs = new HashMap();
        if (knownTransactionDetails) {
            knownTransactionDetails = knownTransactionDetails.map(tx => Client.TransactionDetails.fromPlain(tx));
            for (const receipt of knownTransactionDetails) {
                knownTxs.put(receipt.transactionHash, receipt);
            }
        }

        const consensus = await this._consensus;
        let txs = new HashSet((i) => i instanceof Hash ? i : i.transaction.hash());
        try {
            const pending = await consensus.getPendingTransactionsByAddress(address);
            for (const tx of pending) {
                this._txWaitForExpire(tx);
                txs.add(new Client.TransactionDetails(tx, Client.TransactionState.PENDING));
            }
        } catch (e) {
            // Ignore
        }
        const receipts = new HashSet((receipt) => receipt.transactionHash);
        receipts.addAll(await consensus.getTransactionReceiptsByAddress(address));
        const requestProofs = new HashMap();
        const blockHeights = new HashMap();
        for (const receipt of receipts.valueIterator()) {
            if (knownTxs.contains(receipt.transactionHash)) {
                if (knownTxs.get(receipt.transactionHash).blockHash.equals(receipt.blockHash)) {
                    if (knownTxs.get(receipt.transactionHash).state === Client.TransactionState.CONFIRMED) {
                        continue;
                    }
                }
                // Was mined on different block or not confirmed yet, re-proof
            }
            if (receipt.blockHeight >= sinceBlockHeight) {
                const pendingProofAtBlock = requestProofs.get(receipt.blockHash) || new HashSet();
                pendingProofAtBlock.add(receipt.transactionHash);
                requestProofs.put(receipt.blockHash, pendingProofAtBlock);
                blockHeights.put(receipt.blockHash, receipt.blockHeight);
            }
        }
        for (const details of knownTxs.valueIterator()) {
            if (details.state === Client.TransactionState.MINED || details.state === Client.TransactionState.CONFIRMED) {
                if (!receipts.contains(details)) {
                    const pendingProofAtBlock = requestProofs.get(details.blockHash) || new HashSet();
                    pendingProofAtBlock.add(details.transactionHash);
                    requestProofs.put(details.blockHash, pendingProofAtBlock);
                    blockHeights.put(details.blockHash, details.blockHeight);
                }
            }
        }
        const height = await consensus.getHeadHeight();
        for (const blockHash of requestProofs.keyIterator()) {
            const blockHeight = blockHeights.get(blockHash);
            const moreTx = await consensus.getTransactionsFromBlock(requestProofs.get(blockHash).values(), blockHash, blockHeight);
            const confirmations = (height - blockHeights.get(blockHash)) + 1;
            const confirmed = confirmations >= this._config.requiredBlockConfirmations;
            for (const tx of moreTx) {
                if (!confirmed) this._txWaitForConfirm(tx, blockHeight);
                txs.add(new Client.TransactionDetails(tx[0], confirmed ? Client.TransactionState.CONFIRMED : Client.TransactionState.MINED, blockHash, blockHeight, confirmations));
            }
        }
        for (const /** @type {Client.TransactionDetails} */ details of knownTxs.valueIterator()) {
            if (details.state === Client.TransactionState.NEW || details.state === Client.TransactionState.PENDING || !txs.contains(details)) {
                // Add to mempool
                if (!txs.contains(details)) {
                    if (this._txExpiresAt(details) <= height) {
                        txs.add(new Client.TransactionDetails(details.transaction, Client.TransactionState.EXPIRED));
                    } else {
                        txs.add(this.sendTransaction(details.transaction));
                    }
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
    async addBlockListener(listener) {
        const listenerId = this._listenerId++;
        this._blockListeners.put(listenerId, listener);
        return listenerId;
    }

    /**
     * @param {ConsensusChangedListener} listener
     * @return {Promise.<Handle>}
     */
    async addConsensusChangedListener(listener) {
        const listenerId = this._listenerId++;
        this._consensusChangedListeners.put(listenerId, listener);
        listener(this._consensusState);
        return listenerId;
    }

    /**
     * @param {HeadChangedListener} listener
     * @return {Promise.<Handle>}
     */
    async addHeadChangedListener(listener) {
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
        this._consensusSynchronizer.push(async () => {
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
     */
    removeListener(handle) {
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
