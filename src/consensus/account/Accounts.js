// TODO: verify values and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class Accounts {
    static async getPersistent() {
        const tree = await AccountsTree.getPersistent();
        return new Accounts(tree);
    }

    static async createVolatile() {
        const tree = await AccountsTree.createVolatile();
        return new Accounts(tree);
    }

    constructor(accountsTree) {
        this._tree = accountsTree;
    }

    commitBlock(block) {
        if (!block.accountsHash.equals(this.hash)) throw 'AccountHash mismatch';
        return this._execute(block, (a, b) => a + b);
    }

    revertBlock(block) {
        return this._execute(block, (a, b) => a - b);
    }

    getBalance(address) {
        return this._tree.get(address);
    }

    async _execute(block, operator) {
        await this._executeTransactions(block.body, operator);
        await this._rewardMiner(block.body, operator);
    }

    async _rewardMiner(body, op) {
          // Sum up transaction fees.
        const txFees = body.transactions.reduce( (sum, tx) => sum + tx.fee, 0);
        await this._updateBalance(body.minerAddr, txFees + Policy.BLOCK_REWARD, op);
    }

    async _executeTransactions(body, op) {
        for (let tx of body.transactions) {
            await this._executeTransaction(tx, op);
        }
    }

    async _executeTransaction(tx, op) {
        await this._updateSender(tx, op);
        await this._updateRecipient(tx, op);
    }

    async _updateSender(tx, op) {
        const addr = await tx.senderAddr();
        await this._updateBalance(addr, -tx.value - tx.fee, op);
    }

    async _updateRecipient(tx, op) {
        await this._updateBalance(tx.recipientAddr, tx.value, op);
    }

    async _updateBalance(address, value, operator) {
        // XXX If we don't find a balance, we assume the account is empty for now.
        // TODO retrieve the account balance by asking the network.
        let balance = await this.getBalance(address);
        if (!balance) {
            balance = new Balance();
        }

        const newValue = operator(balance.value, value);
        if (newValue < 0) throw 'Balance Error!';

        const newNonce = value < 0 ? operator(balance.nonce, 1) : balance.nonce;
        if (newNonce < 0) throw 'Nonce Error!';

        const newBalance = new Balance(newValue, newNonce);
        await this._tree.put(address, newBalance);
    }

    get hash() {
        return this._tree.root;
    }
}
