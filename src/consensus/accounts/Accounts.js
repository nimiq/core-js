// TODO: verify values and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class Accounts {

    static getPersistent() {
        const store = AccountsTreeStore.getPersistent();
        return new Accounts(new AccountTree(store));
    }

    static createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return new Accounts(new AccountTree(store));
    }

    constructor(accountsTree) {
        this._tree = accountsTree;
    }

    commitBlock(block) {
        if (!block.header.accountsHash.equals(this.hash)) throw 'AccountHash mismatch';
        return this._execute(block, (a, b) => a + b);
    }

    revertBlock(block) {
        return this._execute(block, (a, b) => a - b);
    }

    getBalance(address) {
        return this._tree.get(addr);
    }

    _execute(block, operator) {
        return this._executeTransactions(block.body, operator)
            .then(_ => this._rewardMiner(block.body, operator));
    }

    _rewardMiner(body, op) {
        return body.transactions()
            .then(txs => txs.reduce((sum, tx) => sum + tx.fee, 0))  // Sum up transaction fees
            .then(txFees => this._updateAccount(body.miner, txFees + Policy.BLOCK_REWARD, op));
    }

    async _executeTransactions(body, op) {
        for (let tx of body.transactions) {
            await this._executeTransaction(tx, op);
        }
    }

    async _executeTransaction(tx, op) {
        await this._updateSender(tx, op);
        await this._updateReceiver(tx, op);
    }

    async _updateSender(tx, op) {
        const addr = await tx.senderAddr();
        await this._updateBalance(addr, -tx.value - tx.fee, op);
    }

    async _updateReceiver(tx, op) {
        await this._updateBalance(tx.receiverAddr, tx.value, op);
    }

    async _updateBalance(address, value, operator) {
        const balance = await this.getBalance(address);
        balance.value = operator(balance.value, value);
        if (balance.value < 0) throw 'BalanceError!';
        if (value < 0) balance.nonce = operator(account.nonce, 1);
        return this._tree.put(address, balance);
    }

    get hash() {
        return this._tree.root;
    }
}
