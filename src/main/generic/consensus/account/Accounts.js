class Accounts extends Observable {
    static async getPersistent() {
        const tree = await AccountsTree.getPersistent();
        return new Accounts(tree);
    }

    static async createVolatile() {
        const tree = await AccountsTree.createVolatile();
        return new Accounts(tree);
    }

    static async createTemporary(backend) {
        const tree = await AccountsTree.createTemporary(backend._tree);
        return new Accounts(tree);
    }

    constructor(accountsTree) {
        super();
        this._tree = accountsTree;

        // Forward balance change events to listeners registered on this Observable.
        this.bubble(this._tree, '*');
    }

    async populate(nodes) {
        // To make sure we have a single transaction, we use a Temporary Tree during populate and commit that.
        const treeTx = await AccountsTreeStore.createTemporary(this._tree._store, true);
        await this._tree.populate(nodes, treeTx);
        if (await this._tree.verify(treeTx)) {
            await treeTx.commit();
            this.fire('populated');
            return true;
        } else {
            return false;
        }
    }

    clear() {
        return this._tree.clear();
    }

    async commitBlock(block) {
        // TODO we should validate if the block is going to be applied correctly.

        const treeTx = await this._tree.transaction();
        await this._execute(treeTx, block.body, (a, b) => a + b);

        const hash = await treeTx.root();
        if (!block.accountsHash.equals(hash)) throw 'AccountsHash mismatch';
        return treeTx.commit();
    }

    async commitBlockBody(body) {
        const treeTx = await this._tree.transaction();
        await this._execute(treeTx, body, (a, b) => a + b);
        return treeTx.commit();
    }

    async revertBlock(block) {
        return this.revertBlockBody(block.body);
    }

    async revertBlockBody(body) {
        const treeTx = await this._tree.transaction();
        await this._execute(treeTx, body, (a, b) => a - b);
        return treeTx.commit();
    }

    // We only support basic accounts at this time.
    async getBalance(address, treeTx = this._tree) {
        const account = await treeTx.get(address);
        if (account) {
            return account.balance;
        } else {
            return Account.INITIAL.balance;
        }
    }

    async _execute(treeTx, body, operator) {
        await this._executeTransactions(treeTx, body, operator);
        await this._rewardMiner(treeTx, body, operator);
    }

    async _rewardMiner(treeTx, body, op) {
        // Sum up transaction fees.
        const txFees = body.transactions.reduce((sum, tx) => sum + tx.fee, 0);
        await this._updateBalance(treeTx, body.minerAddr, txFees + Policy.BLOCK_REWARD, op);
    }

    async _executeTransactions(treeTx, body, op) {
        for (const tx of body.transactions) {
            await this._executeTransaction(treeTx, tx, op); // eslint-disable-line no-await-in-loop
        }
    }

    async _executeTransaction(treeTx, tx, op) {
        await this._updateSender(treeTx, tx, op);
        await this._updateRecipient(treeTx, tx, op);
    }

    async _updateSender(treeTx, tx, op) {
        const addr = await tx.getSenderAddr();
        await this._updateBalance(treeTx, addr, -tx.value - tx.fee, op);
    }

    async _updateRecipient(treeTx, tx, op) {
        await this._updateBalance(treeTx, tx.recipientAddr, tx.value, op);
    }

    async _updateBalance(treeTx, address, value, operator) {
        const balance = await this.getBalance(address, treeTx);

        const newValue = operator(balance.value, value);
        if (newValue < 0) {
            throw 'Balance Error!';
        }

        const newNonce = value < 0 ? operator(balance.nonce, 1) : balance.nonce;
        if (newNonce < 0) {
            throw 'Nonce Error!';
        }

        const newBalance = new Balance(newValue, newNonce);
        const newAccount = new Account(newBalance);
        await treeTx.put(address, newAccount);
    }

    export() {
        return this._tree.export();
    }

    hash() {
        return this._tree.root();
    }
}
Accounts.EMPTY_TREE_HASH = Hash.fromBase64('cJ6AyISHokEeHuTfufIqhhSS0gxHZRUMDHlKvXD4FHw=');
Class.register(Accounts);
