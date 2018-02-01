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
     * @param {TransactionCache} transactionCache
     * @return {Promise}
     */
    async commitBlock(block, transactionCache) {
        const tree = await this._tree.transaction();
        try {
            await this._commitBlockBody(tree, block.body, block.height, transactionCache);
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
     * @param {TransactionCache} transactionCache
     * @return {Promise}
     */
    async commitBlockBody(body, blockHeight, transactionCache) {
        const tree = await this._tree.transaction();
        try {
            await this._commitBlockBody(tree, body, blockHeight, transactionCache);
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
     * @param {TransactionCache} transactionCache
     * @return {Promise<Array.<PrunedAccount>>}
     */
    async gatherToBePrunedAccounts(transactions, blockHeight, transactionCache) {
        const tree = await this._tree.transaction();
        try {
            await this._processSenderAccounts(tree, transactions, blockHeight, transactionCache);
            await this._processRecipientAccounts(tree, transactions, blockHeight);
            await this._processContracts(tree, transactions, blockHeight);

            const toBePruned = [];
            for (const tx of transactions) {
                const senderAccount = await this.get(tx.sender, undefined, tree);
                if (senderAccount.isToBePruned()) {
                    toBePruned.push(new PrunedAccount(tx.sender, senderAccount));
                }
            }
            return toBePruned.sort((a, b) => a.compare(b));
        } finally {
            await tree.abort();
        }
    }

    /**
     * @param {Block} block
     * @param {TransactionCache} transactionCache
     * @return {Promise}
     */
    async revertBlock(block, transactionCache) {
        if (!block) throw new Error('block undefined');

        const hash = await this._tree.root();
        if (!block.accountsHash.equals(hash)) {
            throw new Error('AccountsHash mismatch');
        }
        return this.revertBlockBody(block.body, block.height, transactionCache);
    }

    /**
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @return {Promise}
     */
    async revertBlockBody(body, blockHeight, transactionCache) {
        const tree = await this._tree.transaction();
        try {
            await this._revertBlockBody(tree, body, blockHeight, transactionCache);
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
                return Account.INITIAL;
            }
            throw new Error('Account type was given but account not present');
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
    partialAccountsTree() {
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
     * Step 1)
     * @param {AccountsTree} tree
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @param {boolean} [revert]
     * @returns {Promise.<void>}
     * @private
     */
    async _processSenderAccounts(tree, transactions, blockHeight, transactionCache, revert = false) {
        for (const tx of transactions) {
            const senderAccount = await this.get(tx.sender, tx.senderType, tree);
            await tree.putBatch(tx.sender, senderAccount.withOutgoingTransaction(tx, blockHeight, transactionCache, revert));
        }
    }

    /**
     * Step 2)
     * @param {AccountsTree} tree
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @returns {Promise.<void>}
     * @private
     */
    async _processRecipientAccounts(tree, transactions, blockHeight, revert = false) {
        for (const tx of transactions) {
            const recipientAccount = await this.get(tx.recipient, undefined, tree);
            await tree.putBatch(tx.recipient, recipientAccount.withIncomingTransaction(tx, blockHeight, revert));
        }
    }

    /**
     * Step 3)
     * @param {AccountsTree} tree
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @returns {Promise.<void>}
     * @private
     */
    async _processContracts(tree, transactions, blockHeight, revert = false) {
        // TODO: Filter & sort contract command.
        if (revert) {
            transactions = transactions.slice().reverse();
        }
        for (const tx of transactions) {
            const recipientAccount = await this.get(tx.recipient, undefined, tree);
            await tree.putBatch(tx.recipient, recipientAccount.withContractCommand(tx, blockHeight, revert));
        }
    }

    /**
     * @param {AccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @return {Promise.<void>}
     * @private
     */
    async _commitBlockBody(tree, body, blockHeight, transactionCache) {
        await this._processSenderAccounts(tree, body.transactions, blockHeight, transactionCache);
        await this._processRecipientAccounts(tree, body.transactions, blockHeight);
        await this._processContracts(tree, body.transactions, blockHeight);

        const prunedAccounts = body.prunedAccounts.slice();
        for (const tx of body.transactions) {
            const senderAccount = await this.get(tx.sender, undefined, tree);
            if (senderAccount.isToBePruned()) {
                const accIdx = prunedAccounts.findIndex((acc) => acc.address.equals(tx.sender));
                if (accIdx === -1 || !senderAccount.equals(prunedAccounts[accIdx].account)) {
                    throw new Error('Account was not pruned correctly');
                } else {
                    // Pruned accounts are reset to their initial state
                    await tree.putBatch(tx.sender, Account.INITIAL);
                    prunedAccounts.splice(accIdx, 1);
                }
            }
        }
        if (prunedAccounts.length > 0) {
            throw new Error('Account was invalidly pruned');
        }

        await this._rewardMiner(tree, body, blockHeight, false);
    }

    /**
     * @param {AccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @return {Promise.<void>}
     * @private
     */
    async _revertBlockBody(tree, body, blockHeight, transactionCache) {
        await this._rewardMiner(tree, body, blockHeight, true);

        for (const acc of body.prunedAccounts) {
            await tree.putBatch(acc.address, acc.account);
        }

        // Execute transactions in reverse order.
        await this._processContracts(tree, body.transactions, blockHeight, true);
        await this._processRecipientAccounts(tree, body.transactions, blockHeight, true);
        await this._processSenderAccounts(tree, body.transactions, blockHeight, transactionCache, true);
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
        const coinbaseTransaction = new ExtendedTransaction(
            Address.NULL, Account.Type.BASIC,
            body.minerAddr, Account.Type.BASIC,
            txFees + Policy.blockRewardAt(blockHeight),
            0, // Fee
            0, // ValidityStartHeight
            Transaction.Flag.NONE,
            new Uint8Array(0));

        const recipientAccount = await this.get(body.minerAddr, undefined, tree);
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
        const account = await this.get(address, undefined, tree);
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
