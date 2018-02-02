class MempoolUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;

        this.$transactionCount = this.$el.querySelector('[transaction-count]');
        this.$transactions = this.$el.querySelector('[transactions]');

        if ($.clientType !== DevUI.CLIENT_NANO) {
            $.mempool.on('transactions-ready', () => this._rerender());
            $.mempool.on('transaction-added', tx => this._transactionAdded(tx));
        } else {
            $.mempool.on('*', () => this._rerender(true));
        }

        this._rerender($.clientType === DevUI.CLIENT_NANO);
    }

    _transactionAdded(tx) {
        // XXX inefficient
        const txs = this.$.mempool.getTransactions();
        this.$transactionCount.textContent = txs.length;
        this._renderTransaction(tx);
    }

    _rerender(filter) {
        // XXX inefficient
        const txs = this.$.mempool.getTransactions();
        this.$transactionCount.textContent = txs.length;

        this.$transactions.innerHTML = '';

        txs.forEach(tx => {
            if (filter && !this.$.wallet.address.equals(tx.sender) && !this.$.wallet.address.equals(tx.recipient)) {
                return; // TODO filtering still needed with $.consensus.subscribeAccounts?
            }
            this._renderTransaction(tx);
        });
    }

    _renderTransaction(tx) {
        const el = document.createElement('div');
        const value = Utils.satoshisToCoins(tx.value);
        const fee = Utils.satoshisToCoins(tx.fee);
        el.innerHTML = `from=<hash>${tx.sender.toUserFriendlyAddress(false)}</hash>, to=<hash>${tx.recipient.toUserFriendlyAddress(false)}</hash>, value=${value}, fee=${fee}, validityStartHeight=${tx.validityStartHeight}`;
        this.$transactions.appendChild(el);
    }
}
