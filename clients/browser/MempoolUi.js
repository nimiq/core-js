class MempoolUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;

        this.$transactionCount = this.$el.querySelector('[transaction-count]');
        this.$transactions = this.$el.querySelector('[transactions]');

        if ($.clientType !== DevUi.ClientType.NANO && $.clientType !== DevUi.ClientType.PICO) {
            $.mempool.on('transactions-ready', () => this._rerender());
            $.mempool.on('transaction-added', tx => this._transactionAdded(tx));
        } else {
            $.mempool.on('*', () => this._rerender());
        }

        this._rerender();
    }

    _transactionAdded(tx) {
        // XXX inefficient
        const txs = this.$.mempool.getTransactions();
        this.$transactionCount.textContent = txs.length;
        this._renderTransaction(tx);
    }

    _rerender() {
        // XXX inefficient
        const txs = this.$.mempool.getTransactions();
        this.$transactionCount.textContent = txs.length;

        this.$transactions.innerHTML = '';

        txs.forEach(tx => {
            this._renderTransaction(tx);
        });
    }

    _renderTransaction(tx) {
        const el = document.createElement('div');
        const value = Utils.lunasToCoins(tx.value);
        const fee = Utils.lunasToCoins(tx.fee);
        el.innerHTML = `from=<hash>${tx.sender.toUserFriendlyAddress(false)}</hash>, to=<hash>${tx.recipient.toUserFriendlyAddress(false)}</hash>, value=${value}, fee=${fee}, validityStartHeight=${tx.validityStartHeight}`;
        this.$transactions.appendChild(el);
    }
}
