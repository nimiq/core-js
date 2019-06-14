class MempoolUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;

        this.$transactionCount = this.$el.querySelector('[transaction-count]');
        this.$transactions = this.$el.querySelector('[transactions]');

        $.client.mempool.addTransactionAddedListener((hash) => this._transactionAdded(hash));
        $.client.mempool.addTransactionRemovedListener((hash) => this._transactionRemoved(hash));

        this._rerenderAll();
    }

    _transactionAdded(hash) {
        this.$transactionCount.textContent = (parseInt(this.$transactionCount.textContent) + 1).toString();
        $.client.getTransaction(hash).then(tx => this._addTransaction(tx));
    }

    _transactionRemoved(hash) {
        this.$transactionCount.textContent = (parseInt(this.$transactionCount.textContent) - 1).toString();
        this.$transactions.removeChild(document.getElementById('tx.' + hash.toHex()));
    }

    _rerenderAll() {
        this.$.client.mempool.getTransactions().then((txHashes) => {
            this.$transactionCount.textContent = txHashes.length;

            this.$transactions.innerHTML = '';

            txHashes.forEach(hash => {
                this.$.client.getTransaction(hash).then(tx => this._addTransaction(tx));
            });
        });
    }

    _addTransaction(tx) {
        const el = document.createElement('div');
        el.id = 'tx.' + tx.transactionHash.toHex();
        const value = Utils.lunasToCoins(tx.value);
        const fee = Utils.lunasToCoins(tx.fee);
        el.innerHTML = `from=<hash>${tx.sender.toUserFriendlyAddress(false)}</hash>, to=<hash>${tx.recipient.toUserFriendlyAddress(false)}</hash>, value=${value}, fee=${fee}, validityStartHeight=${tx.validityStartHeight}`;
        this.$transactions.appendChild(el);
    }
}
