// TODO: verify values and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class Accounts {
    static getPersistent() {
        const store = AccountsTreeStore.getPersistent();
        return new Accounts(new AccountsTree(store));
    }

    static createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return new Accounts(new AccountsTree(store));
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

    async _execute(block, operator) {
        await this._executeTransactions(block.body, operator);
        await this._rewardMiner(block.body, operator);
    }

    async _rewardMiner(body, op) {
          // Sum up transaction fees.
        const txFees = body.transactions().reduce( (sum, tx) => sum + tx.fee, 0);
        this._updateAccount(body.minerAddr, txFees + Policy.BLOCK_REWARD, op);
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
