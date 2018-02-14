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
     * @param {Block} genesisBlock
     * @param {string} encodedAccounts
     * @returns {Promise.<void>}
     */
    async initialize(genesisBlock, encodedAccounts) {
        Assert.that(await this._tree.isEmpty());

        const tree = await this._tree.synchronousTransaction();
        try {
            const buf = BufferUtils.fromBase64(encodedAccounts);
            const count = buf.readUint16();
            for (let i = 0; i < count; i++) {
                const address = Address.unserialize(buf);
                const account = Account.unserialize(buf);
                tree.putSync(address, account);
            }

            await this._commitBlockBody(tree, genesisBlock.body, genesisBlock.height, new TransactionCache());

            tree.finalizeBatch();
        } catch (e) {
            await tree.abort();
            throw e;
        }

        const hash = tree.rootSync();
        if (!genesisBlock.accountsHash.equals(hash)) {
            await tree.abort();
            throw new Error('Genesis AccountsHash mismatch');
        }

        return tree.commit();
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
        const tree = await this._tree.synchronousTransaction();
        await tree.preloadAddresses(block.body.getAddresses());
        try {
            this._commitBlockBody(tree, block.body, block.height, transactionCache);
        } catch (e) {
            await tree.abort();
            throw e;
        }

        tree.finalizeBatch();

        const hash = tree.rootSync();
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
        const tree = await this._tree.synchronousTransaction();
        await tree.preloadAddresses(body.getAddresses());
        try {
            this._commitBlockBody(tree, body, blockHeight, transactionCache);
        } catch (e) {
            await tree.abort();
            throw e;
        }
        tree.finalizeBatch();
        return tree.commit();
    }

    /**
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @return {Promise<Array.<PrunedAccount>>}
     */
    async gatherToBePrunedAccounts(transactions, blockHeight, transactionCache) {
        const tree = await this._tree.synchronousTransaction();
        const addresses = [];
        for (const tx of transactions) {
            addresses.push(tx.sender, tx.recipient);
        }
        await tree.preloadAddresses(addresses);
        try {
            this._processSenderAccounts(tree, transactions, blockHeight, transactionCache);
            this._processRecipientAccounts(tree, transactions, blockHeight);
            this._processContracts(tree, transactions, blockHeight);

            const toBePruned = [];
            for (const tx of transactions) {
                const senderAccount = this._getSync(tx.sender, undefined, tree);
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
        const tree = await this._tree.synchronousTransaction();
        await tree.preloadAddresses(body.getAddresses());
        try {
            this._revertBlockBody(tree, body, blockHeight, transactionCache);
        } catch (e) {
            await tree.abort();
            throw e;
        }
        tree.finalizeBatch();
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
     * Gets the {@link Account}-object for an address.
     *
     * @param {Address} address
     * @param {Account.Type} [accountType]
     * @param {SynchronousAccountsTree} tree
     * @private
     * @return {Account}
     */
    _getSync(address, accountType, tree) {
        const account = tree.getSync(address, false);
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
     * @param {SynchronousAccountsTree} tree
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @param {boolean} [revert]
     * @private
     */
    _processSenderAccounts(tree, transactions, blockHeight, transactionCache, revert = false) {
        for (const tx of transactions) {
            const senderAccount = this._getSync(tx.sender, !revert ? tx.senderType : undefined, tree);
            tree.putBatch(tx.sender, senderAccount.withOutgoingTransaction(tx, blockHeight, transactionCache, revert));
        }
    }

    /**
     * Step 2)
     * @param {SynchronousAccountsTree} tree
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @private
     */
    _processRecipientAccounts(tree, transactions, blockHeight, revert = false) {
        for (const tx of transactions) {
            const recipientAccount = this._getSync(tx.recipient, undefined, tree);
            tree.putBatch(tx.recipient, recipientAccount.withIncomingTransaction(tx, blockHeight, revert));
        }
    }

    /**
     * Step 3)
     * @param {SynchronousAccountsTree} tree
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @private
     */
    _processContracts(tree, transactions, blockHeight, revert = false) {
        // TODO: Filter & sort contract command.
        if (revert) {
            transactions = transactions.slice().reverse();
        }
        for (const tx of transactions) {
            const recipientAccount = this._getSync(tx.recipient, !revert ? undefined : tx.recipientType, tree);
            tree.putBatch(tx.recipient, recipientAccount.withContractCommand(tx, blockHeight, revert));
        }
    }

    /**
     * @param {SynchronousAccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @private
     */
    _commitBlockBody(tree, body, blockHeight, transactionCache) {
        this._processSenderAccounts(tree, body.transactions, blockHeight, transactionCache);
        this._processRecipientAccounts(tree, body.transactions, blockHeight);
        this._processContracts(tree, body.transactions, blockHeight);

        const prunedAccounts = body.prunedAccounts.slice();
        for (const tx of body.transactions) {
            const senderAccount = this._getSync(tx.sender, undefined, tree);
            if (senderAccount.isToBePruned()) {
                const accIdx = prunedAccounts.findIndex((acc) => acc.address.equals(tx.sender));
                if (accIdx === -1 || !senderAccount.equals(prunedAccounts[accIdx].account)) {
                    throw new Error('Account was not pruned correctly');
                } else {
                    // Pruned accounts are reset to their initial state
                    tree.putBatch(tx.sender, Account.INITIAL);
                    prunedAccounts.splice(accIdx, 1);
                }
            }
        }
        if (prunedAccounts.length > 0) {
            throw new Error('Account was invalidly pruned');
        }

        this._rewardMiner(tree, body, blockHeight, false);
    }

    /**
     * @param {SynchronousAccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {TransactionCache} transactionCache
     * @private
     */
    _revertBlockBody(tree, body, blockHeight, transactionCache) {
        this._rewardMiner(tree, body, blockHeight, true);

        for (const acc of body.prunedAccounts) {
            tree.putBatch(acc.address, acc.account);
        }

        // Execute transactions in reverse order.
        this._processContracts(tree, body.transactions, blockHeight, true);
        this._processRecipientAccounts(tree, body.transactions, blockHeight, true);
        this._processSenderAccounts(tree, body.transactions, blockHeight, transactionCache, true);
    }

    /**
     * @param {SynchronousAccountsTree} tree
     * @param {BlockBody} body
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @private
     */
    _rewardMiner(tree, body, blockHeight, revert = false) {
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

        const recipientAccount = this._getSync(body.minerAddr, undefined, tree);
        tree.putBatch(body.minerAddr, recipientAccount.withIncomingTransaction(coinbaseTransaction, blockHeight, revert));
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
