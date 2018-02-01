class TransactionUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;

        this.$transactionRecipient = this.$el.querySelector('[transaction-recipient]');
        this.$transactionValue = this.$el.querySelector('[transaction-value]');
        this.$transactionFee = this.$el.querySelector('[transaction-fee]');
        this.$sendButton = this.$el.querySelector('[transaction-send]');

        $.consensus.on('established', () => this.$sendButton.removeAttribute('disabled'));
        $.consensus.on('lost', () => this.$sendButton.setAttribute('disabled', ''));
        this.$sendButton.addEventListener('click', e => this._submitTransaction(e));
    }

    _submitTransaction(e) {
        this.$transactionRecipient.classList.remove('error');
        this.$transactionValue.classList.remove('error');
        this.$transactionFee.classList.remove('error');

        const recipientAddr = this.$transactionRecipient.value;
        let value = parseFloat(this.$transactionValue.value);
        let fee = parseFloat(this.$transactionFee.value);

        let address;
        try {
            address = Nimiq.Address.fromUserFriendlyAddress(recipientAddr);
        } catch (e) {
            this.$transactionRecipient.classList.add('error');
            return;
        }

        if (isNaN(value) || value <= 0) {
            this.$transactionValue.classList.add('error');
            return;
        }

        if (isNaN(fee) || fee < 0) {
            this.$transactionFee.classList.add('error');
            return;
        }

        Utils.getAccount(this.$, this.$.wallet.address).then(account => {
            value = Nimiq.Policy.coinsToSatoshis(value);
            fee = Nimiq.Policy.coinsToSatoshis(fee);

            const waitingTransactions = this.$.mempool.getPendingTransactions(this.$.wallet.publicKey.toAddress());

            if (!account || account.balance < value + fee + waitingTransactions.map(t => t.value + t.fee).reduce((a, b) => a + b, 0)) {
                this.$transactionValue.classList.add('error');
                return;
            }

            const tx = this.$.wallet.createTransaction(address, value, fee, this.$.blockchain.height + 1);
            Utils.broadcastTransaction(this.$, tx);
        });

        e.preventDefault();
        return false;
    }
}
