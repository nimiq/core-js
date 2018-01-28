class Accounts extends Observable {
    /**
     * Generate an Accounts object that is persisted to the local storage.
     * @returns {Promise.<Accounts>} Accounts object
     */
    static async getPersistent(jdb) {
        const tree = await AccountsTree.getPersistent(jdb);
        return new Accounts(tree);
    }

    /**
     * Generate an Accounts object that loses it's data after usage.
     * @returns {Promise.<Accounts>} Accounts object
     */
    static async createVolatile() {
        const tree = await AccountsTree.createVolatile();
        return new Accounts(tree);
    }

    /**
     * @param {AccountsTree} accountsTree
     */
    constructor(accountsTree) {
        super();
        this._tree = accountsTree;

        // Forward balance change events to listeners registered on this Observable.
        this.bubble(this._tree, '*');
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise.<AccountsProof>}
     */
    getAccountsProof(addresses) {
        return this._tree.getAccountsProof(addresses);
    }

    /**
     * @param {string} startPrefix
     * @returns {Promise.<AccountsTreeChunk>}
     */
    getAccountsTreeChunk(startPrefix) {
        return this._tree.getChunk(startPrefix, AccountsTreeChunk.SIZE_MAX);
    }

    /**
     * @param {Block} block
     * @param {TransactionCache} transactionsCache
     * @return {Promise}
     */
    async commitBlock(block, transactionsCache) {
        const tree = await this._tree.transaction();
        try {
            await this._commitBlockBody(tree, block.body, block.height, transactionsCache);
        } catch (e) {
            await tree.abort();
            throw e;
        }

        await tree.finalizeBatch();

        const hash = await tree.root();
        if (!block.accountsHash.equals(hash)) {
            await tree.abort();
            throw new Error('AccountsHash mismatch');
        }
        return tree.commit();
    }

    /**
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @return {Promise}
     */
    async commitBlockBody(body, blockHeight, transactionsCache) {
        const tree = await this._tree.transaction();
        try {
            await this._commitBlockBody(tree, body, blockHeight, transactionsCache);
        } catch (e) {
            await tree.abort();
            throw e;
        }
        await tree.finalizeBatch();
        return tree.commit();
    }

    /**
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @return {Promise<Map.<Address, Account>>}
     */
    async gatherToBePrunedAccounts(transactions, blockHeight, transactionsCache) {
        const tree = await this._tree.transaction();
        const toBePruned = new Map();
        for (const tx of transactions) {
            try {
                await tree.putBatch(tx.sender, (await this.get(tx.sender, tx.senderType, tree)).withOutgoingTransaction(tx, blockHeight, transactionsCache, false));
            } catch (e) {
                // Ignore account errors.
            }
        }
        for (const tx of transactions) {
            try {
                await tree.putBatch(tx.recipient, (await this.get(tx.recipient, undefined, tree) || Account.INITIAL).withIncomingTransaction(tx, blockHeight, false));
            } catch (e) {
                // Ignore account errors.
            }
        }

        for (const tx of transactions) {
            const senderAccount = await this.get(tx.sender, tx.senderType, tree);
            if (senderAccount.isToBePruned()) {
                toBePruned.set(tx.sender, senderAccount);
            }
        }
        await tree.abort();
        return toBePruned;
    }

    /**
     * @param {Block} block
     * @param {TransactionCache} transactionsCache
     * @return {Promise}
     */
    async revertBlock(block, transactionsCache) {
        if (!block) throw new Error('block undefined');

        const hash = await this._tree.root();
        if (!block.accountsHash.equals(hash)) {
            throw new Error('AccountsHash mismatch');
        }
        return this.revertBlockBody(block.body, block.height, transactionsCache);
    }

    /**
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @return {Promise}
     */
    async revertBlockBody(body, blockHeight, transactionsCache) {
        const tree = await this._tree.transaction();
        try {
            await this._revertBlockBody(tree, body, blockHeight, transactionsCache);
        } catch (e) {
            await tree.abort();
            throw e;
        }
        await tree.finalizeBatch();
        return tree.commit();
    }

    /**
     * Gets the {@link Account}-object for an address.
     *
     * @param {Address} address
     * @param {Account.Type} [accountType]
     * @param {AccountsTree} [tree]
     * @return {Promise.<Account>}
     */
    async get(address, accountType, tree = this._tree) {
        const account = await tree.get(address);
        if (!account) {
            if (typeof accountType === 'undefined') {
                return null;
            }
            if (!Account.TYPE_MAP.has(accountType)) {
                throw new Error('Invalid account type');
            }
            return Account.TYPE_MAP.get(accountType).INITIAL;
        } else if (typeof accountType !== 'undefined' && account.type !== accountType) {
            throw new Error('Account type does match actual account');
        }
        return account;
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {Promise.<Accounts>}
     */
    async transaction(enableWatchdog = true) {
        return new Accounts(await this._tree.transaction(enableWatchdog));
    }

    /**
     * @param {Accounts} [tx]
     * @returns {Promise.<Accounts>}
     */
    async snapshot(tx) {
        return new Accounts(await this._tree.snapshot(tx ? tx._tree : undefined));
    }

    /**
     * @returns {Promise.<PartialAccountsTree>}
     */
    async partialAccountsTree() {
        return this._tree.partialTree();
    }

    /**
     * @returns {Promise}
     */
    commit() {
        return this._tree.commit();
    }

    /**
     * @returns {Promise}
     */
    abort() {
        return this._tree.abort();
    }

    /**
     * @param {AccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @return {Promise.<void>}
     * @private
     */
    async _commitBlockBody(tree, body, blockHeight, transactionsCache) {
        for (const tx of body.transactions) {
            await tree.putBatch(tx.sender, (await this.get(tx.sender, tx.senderType, tree)).withOutgoingTransaction(tx, blockHeight, transactionsCache, false));
        }
        for (const tx of body.transactions) {
            await tree.putBatch(tx.recipient, (await this.get(tx.recipient, undefined, tree) || Account.INITIAL).withIncomingTransaction(tx, blockHeight, false));
        }

        for (const tx of body.transactions) {
            const senderAccount = await this.get(tx.sender, tx.senderType, tree);
            if (senderAccount.isToBePruned()) {
                if (!senderAccount.equals(body.prunedAccounts.get(tx.sender))) {
                    throw new Error('Account was not pruned correctly');
                } else {
                    // Pruned accounts are reset to their initial state
                    tree.putBatch(tx.sender, Account.INITIAL);
                }
            }
        }

        await this._rewardMiner(tree, body, blockHeight, false);
    }

    /**
     * @param {AccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @return {Promise.<void>}
     * @private
     */
    async _revertBlockBody(tree, body, blockHeight, transactionsCache) {
        await this._rewardMiner(tree, body, blockHeight, true);

        for (const addr of body.prunedAccounts.keys()) {
            tree.putBatch(addr, body.prunedAccounts.get(addr));
        }

        // Execute transactions in reverse order.
        for (const tx of body.transactions.slice().reverse()) {
            await tree.putBatch(tx.recipient, (await this.get(tx.recipient, undefined, tree) || Account.INITIAL).withIncomingTransaction(tx, blockHeight, true));
        }
        for (const tx of body.transactions.slice().reverse()) {
            await tree.putBatch(tx.sender, (await this.get(tx.sender, tx.senderType, tree)).withOutgoingTransaction(tx, blockHeight, transactionsCache, true));
        }
    }

    /**
     * @param {AccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Promise.<void>}
     * @private
     */
    async _rewardMiner(tree, body, blockHeight, revert = false) {
        // Sum up transaction fees.
        const txFees = body.transactions.reduce((sum, tx) => sum + tx.fee, 0);

        // "Coinbase transaction"
        const coinbaseTransaction = new ExtendedTransaction(Address.NULL, Account.Type.BASIC, body.minerAddr, Account.Type.BASIC, txFees + Policy.blockRewardAt(blockHeight), 0, 0, new Uint8Array(0));

        const recipientAccount = await this.get(body.minerAddr, undefined, tree) || Account.INITIAL;
        await tree.putBatch(body.minerAddr, recipientAccount.withIncomingTransaction(coinbaseTransaction, blockHeight, revert));
    }

    /**
     * @param {AccountsTree} tree
     * @param {Address} address
     * @param {number} value
     * @returns {Promise.<void>}
     * @deprecated
     * @private
     */
    async _addBalance(tree, address, value) {
        const account = await this.get(address, undefined, tree) || Account.INITIAL;
        await tree.putBatch(address, account.withBalance(account.balance + value));
    }

    /**
     * @returns {Promise.<Hash>}
     */
    hash() {
        return this._tree.root();
    }

    /** @type {Transaction} */
    get tx() {
        return this._tree.tx;
    }
}

Class.register(Accounts);
