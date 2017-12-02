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
     * @return {Promise}
     */
    async commitBlock(block) {
        const tree = await this._tree.transaction();
        try {
            await this._commitBlockBody(tree, block.body);
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
     * @return {Promise}
     */
    async commitBlockBody(body) {
        const tree = await this._tree.transaction();
        try {
            await this._commitBlockBody(tree, body);
        } catch (e) {
            await tree.abort();
            throw e;
        }
        await tree.finalizeBatch();
        return tree.commit();
    }

    /**
     * @param {Block} block
     * @return {Promise}
     */
    async revertBlock(block) {
        if (!block) throw new Error('block undefined');

        const hash = await this._tree.root();
        if (!block.accountsHash.equals(hash)) {
            throw new Error('AccountsHash mismatch');
        }
        return this.revertBlockBody(block.body);
    }

    /**
     * @param {BlockBody} body
     * @return {Promise}
     */
    async revertBlockBody(body) {
        const tree = await this._tree.transaction();
        try {
            await this._revertBlockBody(tree, body);
        } catch (e) {
            await tree.abort();
            throw e;
        }
        await tree.finalizeBatch();
        return tree.commit();
    }

    /**
     * Gets the current balance of an account.
     *
     * We only support basic accounts at this time.
     * @param {Address} address Address of the account to query.
     * @param {AccountsTree} [tree] AccountsTree or transaction to read from.
     * @return {Promise.<Balance>} Current Balance of given address.
     */
    async getBalance(address, tree = this._tree) {
        const account = await tree.get(address);
        if (account) {
            return account.balance;
        } else {
            return Account.INITIAL.balance;
        }
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
     * @return {Promise.<void>}
     * @private
     */
    async _commitBlockBody(tree, body) {
        const operator = (a, b) => a + b;

        for (const tx of body.transactions.slice().sort((a, b) => a.compareAccountOrder(b))) {
            await this._executeTransaction(tree, tx, operator);
        }

        await this._rewardMiner(tree, body, operator);
    }

    /**
     * @param {AccountsTree} tree
     * @param {BlockBody} body
     * @return {Promise.<void>}
     * @private
     */
    async _revertBlockBody(tree, body) {
        const operator = (a, b) => a - b;

        // Execute transactions in reverse order.
        for (const tx of body.transactions.slice().sort((a, b) => a.compareAccountOrder(b)).reverse()) {
            await this._executeTransaction(tree, tx, operator);
        }

        await this._rewardMiner(tree, body, operator);
    }

    /**
     * @param {AccountsTree} tree
     * @param {BlockBody} body
     * @param {Function} op
     * @return {Promise.<void>}
     * @private
     */
    async _rewardMiner(tree, body, op) {
        // Sum up transaction fees.
        const txFees = body.transactions.reduce((sum, tx) => sum + tx.fee, 0);
        await this._updateBalance(tree, body.minerAddr, txFees + Policy.BLOCK_REWARD, op);
    }

    /**
     * @param {AccountsTree} tree
     * @param {Transaction} tx
     * @param {Function} op
     * @returns {Promise.<void>}
     * @private
     */
    async _executeTransaction(tree, tx, op) {
        await this._updateSender(tree, tx, op);
        await this._updateRecipient(tree, tx, op);
    }

    /**
     * @param {AccountsTree} tree
     * @param {Transaction} tx
     * @param {Function} op
     * @returns {Promise.<void>}
     * @private
     */
    async _updateSender(tree, tx, op) {
        const addr = await tx.getSenderAddr();
        await this._updateBalanceAndNonce(tree, addr, -tx.value - tx.fee, tx.nonce, op);
    }

    /**
     * @param {AccountsTree} tree
     * @param {Transaction} tx
     * @param {Function} op
     * @returns {Promise.<void>}
     * @private
     */
    async _updateRecipient(tree, tx, op) {
        await this._updateBalance(tree, tx.recipientAddr, tx.value, op);
    }

    /**
     * @param {AccountsTree} tree
     * @param {Address} address
     * @param {number} value
     * @param {Function} operator
     * @returns {Promise.<void>}
     * @private
     */
    async _updateBalance(tree, address, value, operator) {
        const balance = await this.getBalance(address, tree);

        const newValue = operator(balance.value, value);
        if (newValue < 0) {
            throw new Error('Balance Error!');
        }

        const newBalance = new Balance(newValue, balance.nonce);
        const newAccount = new Account(newBalance);
        await tree.putBatch(address, newAccount);
    }

    /**
     *
     * @param {AccountsTree} tree
     * @param {Address} address
     * @param {number} value
     * @param {number} nonce
     * @param {Function} operator
     * @returns {Promise.<void>}
     * @private
     */
    async _updateBalanceAndNonce(tree, address, value, nonce, operator) {
        const balance = await this.getBalance(address, tree);

        const newValue = operator(balance.value, value);
        if (newValue < 0) {
            throw new Error('Balance Error!');
        }

        const newNonce = operator(balance.nonce, 1);
        const reverting = newNonce < balance.nonce;
        if (newNonce < 0 || (reverting && nonce !== newNonce) || (!reverting && nonce !== balance.nonce)) {
            throw new Error('Nonce Error!');
        }

        const newBalance = new Balance(newValue, newNonce);
        const newAccount = new Account(newBalance);
        await tree.putBatch(address, newAccount);
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
Accounts.EMPTY_TREE_HASH = Hash.fromBase64('qynm3BZ1XQBx66NJ69oiXRXk+RDLR0VJxH6Vy4XsxNY=');
Class.register(Accounts);
