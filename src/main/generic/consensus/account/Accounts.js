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

    async commitBlock(block) {
        const hash = await this.hash();
        if (!block.accountsHash.equals(hash)) throw 'AccountsHash mismatch';
        // TODO we should validate if the block is going to be applied correctly.

        const treeTx = await this._tree.transaction();
        await this._execute(treeTx, block, (a, b) => a + b);
        return treeTx.commit();
    }

    async revertBlock(block) {
        const treeTx = await this._tree.transaction();
        await this._execute(treeTx, block, (a, b) => a - b);
        return treeTx.commit();
    }

    // We only support basic accounts at this time.
    async getBalance(address) {
        const account = await this._tree.get(address);
        if (account) {
            return account.balance;
        } else {
            return Account.INITIAL.balance;
        }
    }

    async _execute(treeTx, block, operator) {
        await this._executeTransactions(treeTx, block.body, operator);
        await this._rewardMiner(treeTx, block.body, operator);
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
        const addr = await tx.senderAddr();
        await this._updateBalance(treeTx, addr, -tx.value - tx.fee, op);
    }

    async _updateRecipient(treeTx, tx, op) {
        await this._updateBalance(treeTx, tx.recipientAddr, tx.value, op);
    }

    async _updateBalance(treeTx, address, value, operator) {
        const balance = await this.getBalance(address);

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

    hash() {
        return this._tree.root();
    }
}
Class.register(Accounts);
