// TODO: verify balances and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class AccountsState {

  constructor(db) {
    this._tree = new AccountsTree(db);
  }

  commitBlock(block) {
    if (!block.header.accountsHash.equals(this.hash)) throw 'AccountHash mismatch';
    return this._execute(block, (a, b) => a + b);
  }

  revertBlock(block) {
    return this._execute(block, (a, b) => a - b);
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
    const txs = await body.transactions();
    for (let tx of txs) {
      await this._executeTransaction(tx, op);
    }
  }

  _executeTransaction(tx, op) {
    return this._updateSender(tx, op)
        .then(_ => this._updateReceiver(tx, op));
  }

  _updateSender(tx, op) {
    return tx.senderAddr()
        .then(addr => this._updateAccount(addr, -tx.value - tx.fee, op));
  }

  _updateReceiver(tx, op) {
    return this._updateAccount(tx.receiver, tx.value, op);
  }

  async _updateAccount(address, value, operator) {
    const addr = Buffer.toBase64(address);
    const account = await this.fetch(address);
    account.value = operator(account.value, value);
    if (account.value < 0) throw 'BalanceError!';
    if (value < 0) account.nonce = operator(account.nonce, 1);
    return this._tree.put(addr, account);
  }

  fetch(address) {
    const addr = Buffer.toBase64(address);
    return this._tree.get(addr).then(account => account ?
        new AccountState(account.balance, account.nonce) : new AccountState());
  }

  get hash() {
    return this._tree.root;
  }
}
