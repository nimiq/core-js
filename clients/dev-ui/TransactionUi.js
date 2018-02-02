class TransactionUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this._transactionType = null;

        this.$typeSelector = this.$el.querySelector('[tx-type-selector]');

        this.$recipient = this.$el.querySelector('[tx-recipient]');
        this.$recipientType = this.$el.querySelector('[tx-recipient-type]');
        this.$value = this.$el.querySelector('[tx-value]');
        this.$fee = this.$el.querySelector('[tx-fee]');
        this.$validityStart = this.$el.querySelector('[tx-validity-start]');
        this.$flags = this.$el.querySelector('[tx-flags]');
        this.$data = this.$el.querySelector('[tx-data]');
        this.$proof = this.$el.querySelector('[tx-proof]');

        this.$vestingOwner = this.$el.querySelector('[tx-vesting-owner]');
        this.$vestingStepBlocks = this.$el.querySelector('[tx-vesting-step-blocks]');
        this.$vestingStepAmount = this.$el.querySelector('[tx-vesting-step-amount]');
        this.$vestingStart = this.$el.querySelector('[tx-vesting-start]');
        this.$vestingTotalAmount = this.$el.querySelector('[tx-vesting-total-amount]');

        this.$htlcSender = this.$el.querySelector('[tx-htlc-sender]');
        this.$htlcRecipient = this.$el.querySelector('[tx-htlc-recipient]');
        this.$htlcHashAlgo = this.$el.querySelector('[tx-htlc-hash-algo]');
        this.$htlcHashRoot = this.$el.querySelector('[tx-htlc-hash-root]');
        this.$htlcHashCount = this.$el.querySelector('[tx-htlc-hash-count]');
        this.$htlcTimeout = this.$el.querySelector('[tx-htlc-timeout]');

        this.$contractAddress = this.$el.querySelector('[contract-address]');
        this.$sendButton = this.$el.querySelector('[tx-send]');
        this.$clearButton = this.$el.querySelector('[tx-clear]');

        $.consensus.on('established', () => this.$sendButton.removeAttribute('disabled'));
        $.consensus.on('lost', () => this.$sendButton.setAttribute('disabled', ''));
        this.$typeSelector.addEventListener('change', () => this._onTransactionTypeSelected());
        this.$sendButton.addEventListener('click', e => this._sendTransaction(e));
        this.$clearButton.addEventListener('click', e => this._clear(e));

        this.$validityStart.setAttribute('placeholder', this._getDefaultValidityStart());
        $.blockchain.on('head-changed',
            () => this.$validityStart.setAttribute('placeholder', this._getDefaultValidityStart()));

        this._onTransactionTypeSelected();
    }

    _onTransactionTypeSelected() {
        const txType = this.$typeSelector.selectedOptions[0].value;
        if (Object.values(TransactionUi.TxType).indexOf(txType) === -1) {
            alert(`Unknown transaction type ${txType}`);
            return;
        }
        this._transactionType = txType;
        this.$el.setAttribute(TransactionUi.ATTRIBUTE_TX_TYPE, txType);
    }

    _sendTransaction(e) {
        e.preventDefault();

        const wallet = this.$.wallet;
        Utils.getAccount(this.$, wallet.address).then(account => {
            if (!account) {
                // sender account doesn't exist and thus has value 0
                this.$value.classList.add('error');
                return;
            }

            const sender = {
                address: wallet.address,
                keyPair: wallet.keyPair,
                accountType: account.type
            };
            const tx = this._createTransaction(sender);
            if (!tx) return;

            const waitingTransactions = this.$.mempool.getPendingTransactions(sender.address);
            if (account.balance < tx.value + tx.fee + waitingTransactions.map(t => t.value + t.fee).reduce((a, b) => a + b, 0)) {
                this.$value.classList.add('error');
                return;
            }

            this._signTransaction(sender, tx);
            if (tx.hasFlag(Nimiq.Transaction.Flag.CONTRACT_CREATION)) {
                this.$contractAddress.textContent = tx.getContractCreationAddress().toUserFriendlyAddress();
            }

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

    _readNumber(input) {
        const value = parseFloat(input.value);
        if (isNaN(value)) {
            input.classList.add('error');
            return null;
        } else {
            input.classList.remove('error');
            return value;
        }
    }

    _readBase64(input) {
        try {
            const buffer = Nimiq.BufferUtils.fromBase64(input.value);
            input.classList.remove('error');
            return buffer;
        } catch(e) {
            input.classList.add('error');
            return null;
        }
    }

    _readHash(input, hashAlgo) {
        const buffer = this._readBase64(input);
        if (buffer === null) return null;
        try {
            return Nimiq.Hash.unserialize(buffer, hashAlgo);
            // no need to remove error class, as already done in _readBase64
        } catch(e) {
            input.classList.add('error');
            return null;
        }
    }

    _readTransactionCanonicals() {
        let value = this._readNumber(this.$value);
        let fee = this._readNumber(this.$fee);
        let validityStart;
        if (this.$validityStart.value === '') {
            validityStart = this._getDefaultValidityStart();
            this.$validityStart.classList.remove('error');
        } else {
            validityStart = this._readNumber(this.$validityStart);
        }
        if (value === null || fee === null || validityStart === null) return null;
        value = Nimiq.Policy.coinsToSatoshis(value);
        fee = Nimiq.Policy.coinsToSatoshis(fee);
        return {
            value: value,
            fee: fee,
            validityStart: validityStart
        };
    }

    _getDefaultValidityStart() {
        return this.$.blockchain.height + 1;
    }

    _clear(e) {
        e.preventDefault();
        Array.prototype.forEach.call(this.$el.querySelectorAll('input'), input => {
            input.value = '';
            input.classList.remove('error');
        });
        this.$contractAddress.textContent = '';
    }

    _createTransaction(sender) {
        switch(this._transactionType) {
            case TransactionUi.TxType.BASIC:
                return this._createBasicTransaction(sender);
            case TransactionUi.TxType.EXTENDED:
                return this._createPlainExtendedTransaction(sender);
            case TransactionUi.TxType.VESTING:
                return this._createVestingCreationTransaction(sender);
            case TransactionUi.TxType.HTLC:
                return this._createHtlcCreationTransaction(sender);
            default:
                alert('Transaction Type not implemented yet');
                return null;
        }
    }

    _createBasicTransaction(sender) {
        const canonicals = this._readTransactionCanonicals();
        const recipient = this._readAddress(this.$recipient);
        if (canonicals === null || recipient === null) return null;
        return new Nimiq.BasicTransaction(sender.keyPair.publicKey, recipient, canonicals.value, canonicals.fee,
            canonicals.validityStart);
    }

    _createPlainExtendedTransaction(sender) {
        const canonicals = this._readTransactionCanonicals();
        const recipient = this._readAddress(this.$recipient);
        const recipientType = this._readNumber(this.$recipientType);
        const flags = this._readNumber(this.$flags);
        const data = this._readBase64(this.$data);
        const proof = this._readBase64(this.$proof);
        if (canonicals === null || recipient === null || recipientType === null || flags === null || data === null
            || proof === null) {
            return null;
        }
        return new Nimiq.ExtendedTransaction(sender.address, sender.accountType, recipient, recipientType,
            canonicals.value, canonicals.fee, canonicals.validityStart, flags, data, proof);
    }

    _createVestingCreationTransaction(sender) {
        const canonicals = this._readTransactionCanonicals();
        const vestingOwner = this._readAddress(this.$vestingOwner);
        const vestingStepBlocks = this._readNumber(this.$vestingStepBlocks);
        if (canonicals === null || vestingOwner === null || vestingStepBlocks === null) return null;

        const requiresVestingTotalAmount = this.$vestingTotalAmount.value !== '';
        const requiresVestingStartAndStepAmount = this.$vestingStart.value !== ''
            || this.$vestingStepAmount.value !== '' || requiresVestingTotalAmount;

        const bufferSize = vestingOwner.serializedSize + /* vestingStepBlocks*/ 4
            + (requiresVestingStartAndStepAmount? /* vestingStart */ 4 + /* vestingStepAmount */ 8 : 0)
            + (requiresVestingTotalAmount? /* vestingTotalAmount */ 8 : 0);

        let vestingStart, vestingStepAmount, vestingTotalAmount;

        if (requiresVestingStartAndStepAmount) {
            vestingStart = this._readNumber(this.$vestingStart);
            vestingStepAmount = this._readNumber(this.$vestingStepAmount);
            if (vestingStart === null || vestingStepAmount === null) return null;
            vestingStepAmount = Nimiq.Policy.coinsToSatoshis(vestingStepAmount);
        }
        if (requiresVestingTotalAmount) {
            vestingTotalAmount = this._readNumber(this.$vestingTotalAmount);
            if (vestingTotalAmount === null) return null;
            vestingTotalAmount = Nimiq.Policy.coinsToSatoshis(vestingTotalAmount);
        }

        const buffer = new Nimiq.SerialBuffer(bufferSize);
        vestingOwner.serialize(buffer);

        if (requiresVestingStartAndStepAmount) {
            buffer.writeUint32(vestingStart);
            buffer.writeUint32(vestingStepBlocks);
            buffer.writeUint64(vestingStepAmount);
            if (requiresVestingTotalAmount) {
                buffer.writeUint64(vestingTotalAmount);
            }
        } else {
            buffer.writeUint32(vestingStepBlocks);
        }

        const recipient = Nimiq.Address.CONTRACT_CREATION;
        const recipientType = Nimiq.Account.Type.VESTING;
        const flags = Nimiq.Transaction.Flag.CONTRACT_CREATION;
        return new Nimiq.ExtendedTransaction(sender.address, sender.accountType, recipient, recipientType,
            canonicals.value, canonicals.fee, canonicals.validityStart, flags, buffer);
    }

    _createHtlcCreationTransaction(sender) {
        const canonicals = this._readTransactionCanonicals();
        const htlcSender = this._readAddress(this.$htlcSender);
        const htlcRecipient = this._readAddress(this.$htlcRecipient);
        const hashAlgo = this._readNumber(this.$htlcHashAlgo);
        const hashRoot = this._readHash(this.$htlcHashRoot, hashAlgo);
        const hashCount = this._readNumber(this.$htlcHashCount);
        const timeout = this._readNumber(this.$htlcTimeout);
        if (canonicals === null || htlcSender === null || htlcRecipient === null || hashAlgo === null
            || hashRoot === null || hashCount === null || timeout === null) return null;

        const bufferSize = htlcSender.serializedSize
            + htlcRecipient.serializedSize
            + /* hashAlgo */ 1
            + hashRoot.serializedSize
            + /* hashCount */ 1
            + /* timeout */ 4;
        const buffer =  new Nimiq.SerialBuffer(bufferSize);
        htlcSender.serialize(buffer);
        htlcRecipient.serialize(buffer);
        buffer.writeUint8(hashAlgo);
        hashRoot.serialize(buffer);
        buffer.writeUint8(hashCount);
        buffer.writeUint32(timeout);

        const recipient = Nimiq.Address.CONTRACT_CREATION;
        const recipientType = Nimiq.Account.Type.HTLC;
        const flags = Nimiq.Transaction.Flag.CONTRACT_CREATION;
        return new Nimiq.ExtendedTransaction(sender.address, sender.accountType, recipient, recipientType,
            canonicals.value, canonicals.fee, canonicals.validityStart, flags, buffer);
    }

    _signTransaction(sender, tx) {
        const signature = Nimiq.Signature.create(sender.keyPair.privateKey, sender.keyPair.publicKey, tx.serializeContent());
        if (tx instanceof Nimiq.BasicTransaction) {
            tx.signature = signature;
        } else {
            const signatureProof = Nimiq.SignatureProof.singleSig(sender.keyPair.publicKey, signature).serialize();
            tx.proof = signatureProof;
        }
    }
}
TransactionUi.ATTRIBUTE_TX_TYPE = 'tx-type';
TransactionUi.TxType = {
    EXTENDED: 'extended',
    BASIC: 'basic',
    VESTING: 'vesting-creation',
    HTLC: 'htlc-creation'
};
