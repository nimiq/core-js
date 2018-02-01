class TransactionUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this._transactionType = null;

        this.$txTypeSelector = this.$el.querySelector('[tx-type-selector]');

        this.$txRecipient = this.$el.querySelector('[tx-recipient]');
        this.$txRecipientType = this.$el.querySelector('[tx-recipient-type]');
        this.$txValue = this.$el.querySelector('[tx-value]');
        this.$txFee = this.$el.querySelector('[tx-fee]');
        this.$txValidityStart = this.$el.querySelector('[tx-validity-start]');
        this.$txFlags = this.$el.querySelector('[tx-flags]');
        this.$txData = this.$el.querySelector('[tx-data]');
        this.$txProof = this.$el.querySelector('[tx-proof]');
        this.$contractAddress = this.$el.querySelector('[contract-address]');
        this.$sendButton = this.$el.querySelector('[tx-send]');
        this.$clearButton = this.$el.querySelector('[tx-clear]');

        $.consensus.on('established', () => this.$sendButton.removeAttribute('disabled'));
        $.consensus.on('lost', () => this.$sendButton.setAttribute('disabled', ''));
        this.$txTypeSelector.addEventListener('change', () => this._onTransactionTypeSelected());
        this.$sendButton.addEventListener('click', e => this._sendTransaction(e));
        this.$clearButton.addEventListener('click', e => this._clear(e));

        this.$txValidityStart.setAttribute('placeholder', this._getDefaultValidityStart());
        $.blockchain.on('head-changed',
            () => this.$txValidityStart.setAttribute('placeholder', this._getDefaultValidityStart()));

        this._onTransactionTypeSelected();
    }

    _onTransactionTypeSelected() {
        const txType = this.$txTypeSelector.selectedOptions[0].value;
        if (Object.values(TransactionUi.TxType).indexOf(txType) === -1) {
            alert(`Unknown transaction type ${txType}`);
            return;
        }
        this._transactionType = txType;
        this.$el.setAttribute(TransactionUi.ATTRIBUTE_TX_TYPE, txType);
    }

    _sendTransaction(e) {
        e.preventDefault();
        const recipient = this._readAddress(this.$txRecipient);
        let value = this._readNumber(this.$txValue, value => value > 0);
        let fee = this._readNumber(this.$txFee, fee => fee >= 0);
        let validityStart;
        if (this.$txValidityStart.value === '') {
            validityStart = this._getDefaultValidityStart();
            this.$txValidityStart.classList.remove('error');
        } else {
            validityStart = this._readNumber(this.$txValidityStart, start => start >= 0);
        }
        if (recipient === null || value === null || fee === null || validityStart === null) return;

        value = Nimiq.Policy.coinsToSatoshis(value);
        fee = Nimiq.Policy.coinsToSatoshis(fee);
        Utils.getAccount(this.$, this.$.wallet.address).then(account => {
            const waitingTransactions = this.$.mempool.getPendingTransactions(this.$.wallet.address);
            if (!account || account.balance < value + fee + waitingTransactions.map(t => t.value + t.fee).reduce((a, b) => a + b, 0)) {
                this.$txValue.classList.add('error');
                return;
            }

            const tx = this._createTransaction(this.$.wallet, recipient, value, fee, validityStart);
            if (!tx) return;
            this._signTransaction(this.$.wallet, tx);
            this.$contractAddress.textContent = tx.getContractCreationAddress().toUserFriendlyAddress();

            Utils.broadcastTransaction(this.$, tx);
        });
    }

    _readAddress(input) {
        try {
            const address =  Nimiq.Address.fromUserFriendlyAddress(input.value);
            input.classList.remove('error');
            return address;
        } catch (e) {
            input.classList.add('error');
            return null;
        }
    }

    _readNumber(input, validate) {
        validate = validate || (() => true);
        const value = parseFloat(input.value);
        if (isNaN(value) || !validate(value)) {
            input.classList.add('error');
            return null;
        } else {
            input.classList.remove('error');
            return value;
        }
    }

    _readBase64(input) {
        try {
            const buf = Nimiq.BufferUtils.from(input.value);
            input.classList.remove('error');
            return buf;
        } catch(e) {
            input.classList.add('error');
            return null;
        }
    }

    _getDefaultValidityStart() {
        return this.$.blockchain.height + 1;
    }

    _clear(e) {
        e.preventDefault()
        Array.prototype.forEach.call(this.$el.querySelectorAll('input'), input => {
            input.value = '';
            input.classList.remove('error');
        });
        this.$contractAddress.textContent = '';
    }

    _createTransaction(wallet, recipient, value, fee, validityStart) {
        switch(this._transactionType) {
            case TransactionUi.TxType.BASIC:
                return this._createBasicTransaction(wallet, recipient, value, fee, validityStart);
            case TransactionUi.TxType.EXTENDED:
                return this._createPlainExtendedTransaction(wallet, recipient, value, fee, validityStart);
            /*case TransactionUi.TxType.VESTING:
                return this._createVestingCreationTransaction();
            case TransactionUi.TxType.HTLC:
                return this._createHtlcCreationTransaction();*/
            default:
                alert('Transaction Type not implemented yet');
                return null;
        }
    }

    _createBasicTransaction(wallet, recipient, value, fee, validityStart) {
        return new Nimiq.BasicTransaction(wallet.keyPair.publicKey, recipient, value, fee, validityStart);
    }

    _createPlainExtendedTransaction(wallet, recipient, value, fee, validityStart) {
        const sender = wallet.address;
        const senderType = Nimiq.Account.Type.BASIC;
        const recipientType = this._readNumber(this.$txRecipientType,
            type => Object.values(Nimiq.Account.Type).indexOf(type) !== -1);
        const flags = this._readNumber(this.$txFlags);
        const data = this._readBase64(this.$txData);
        const proof = this._readBase64(this.$txProof);
        if (recipientType === null || flags === null || data === null || proof === null) {
            return null;
        }
        return new Nimiq.ExtendedTransaction(sender, senderType, recipient, recipientType, value, fee, validityStart,
            flags, data, proof);
    }

    _createVestingCreationTransaction() {

    }

    _createHtlcCreationTransaction() {

    }

    _signTransaction(wallet, tx) {
        tx.signature = Nimiq.Signature.create(wallet.keyPair.privateKey, wallet.keyPair.publicKey, tx.serializeContent());
    }
}
TransactionUi.ATTRIBUTE_TX_TYPE = 'tx-type';
TransactionUi.TxType = {
    EXTENDED: 'extended',
    BASIC: 'basic',
    VESTING: 'vesting-contract-creation',
    HTLC: 'htlc-contract-creation'
};
