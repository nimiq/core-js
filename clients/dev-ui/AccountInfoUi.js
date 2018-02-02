class AccountInfoUi {
    constructor(el, $) {
        this.$el = el;
        this.$addressInput = this.$el.querySelector('[address-input]');
        this.$clearButton = this.$el.querySelector('[clear-button]');
        this.$address = this.$el.querySelector('[address]');
        this.$balance = this.$el.querySelector('[balance]');

        this.$vestingOwner = this.$el.querySelector('[vesting-owner]');
        this.$vestingStart = this.$el.querySelector('[vesting-start]');
        this.$vestingStepBlocks = this.$el.querySelector('[vesting-step-blocks]');
        this.$vestingStepAmount = this.$el.querySelector('[vesting-step-amount]');
        this.$vestingTotalAmount = this.$el.querySelector('[vesting-total-amount]');
        this.$vestingCurrentCap = this.$el.querySelector('[vesting-current-cap]');
        this.$vestingCurrentlyTransferable = this.$el.querySelector('[vesting-currently-transferable]');

        this.$htlcSender = this.$el.querySelector('[htlc-sender]');
        this.$htlcRecipient = this.$el.querySelector('[htlc-recipient]');
        this.$htlcHashRoot = this.$el.querySelector('[htlc-hash-root]');
        this.$htlcHashCount = this.$el.querySelector('[htlc-hash-count]');
        this.$htlcTimeout = this.$el.querySelector('[htlc-timeout]');
        this.$htlcTotalAmount = this.$el.querySelector('[htlc-total-amount]');

        this.$ = $;
        this._address = $.wallet.address;
        this.$addressInput.setAttribute('placeholder', $.wallet.address.toUserFriendlyAddress());
        this._reset();

        this.$addressInput.addEventListener('input', () => this._onAddressInput());
        this.$clearButton.addEventListener('click', () => this._reset());
        this.$.blockchain.on('head-changed', (head, rebranching) => this._update(head, rebranching));
        this.$.consensus.on('established', () => this._update());
    }

    _reset() {
        this.$addressInput.value = '';
        this._setAddress($.wallet.address);
    }

    _setAddress(address) {
        this._address = address;
        this.$address.textContent = address.toUserFriendlyAddress();
        this._update();
    }

    _onAddressInput() {
        const userFriendlyAddress = this.$addressInput.value;
        if (userFriendlyAddress === '') {
            this._setAddress(this.$.wallet.address);
            return;
        }
        let address;
        try {
            address = Nimiq.Address.fromUserFriendlyAddress(userFriendlyAddress);
        } catch(e) {
            this.$addressInput.classList.add('error');
            return;
        }
        this.$addressInput.classList.remove('error');
        this._setAddress(address);
    }

    _update(head, rebranching) {
        if (this.$.clientType === DevUI.CLIENT_NANO && rebranching) {
            return; // updates are expensive on nano, so don't do it till consensus
        }
        Utils.getAccount(this.$, this._address).then(account => {
            if (!account) {
                this.$el.setAttribute(AccountInfoUi.ATTRIBUTE_ACCOUNT_TYPE, AccountInfoUi.AccountType.NOT_FOUND);
                return;
            }
            this.$balance.textContent = Utils.satoshisToCoins(account.balance);
            switch (account.type) {
                case Nimiq.Account.Type.BASIC:
                    this.$el.setAttribute(AccountInfoUi.ATTRIBUTE_ACCOUNT_TYPE, AccountInfoUi.AccountType.BASIC);
                    break;
                case Nimiq.Account.Type.VESTING:
                    this.$el.setAttribute(AccountInfoUi.ATTRIBUTE_ACCOUNT_TYPE, AccountInfoUi.AccountType.VESTING);
                    this._updateVestingDetails(account);
                    break;
                case Nimiq.Account.Type.HTLC:
                    this.$el.setAttribute(AccountInfoUi.ATTRIBUTE_ACCOUNT_TYPE, AccountInfoUi.AccountType.HTLC);
                    this._updateHtlcDetails(account);
                    break;
                default:
                    this.$el.setAttribute(AccountInfoUi.ATTRIBUTE_ACCOUNT_TYPE, AccountInfoUi.AccountType.UNKNOWN);
            }
        });
    }

    _updateVestingDetails(contract) {
        this.$vestingOwner.textContent = contract.owner.toUserFriendlyAddress();
        this.$vestingStart.textContent = contract.vestingStart;
        this.$vestingStepBlocks.textContent = contract.vestingStepBlocks;
        this.$vestingStepAmount.textContent = Utils.satoshisToCoins(contract.vestingStepAmount);
        this.$vestingTotalAmount.textContent = Utils.satoshisToCoins(contract.vestingTotalAmount);
        const currentMinCap = contract.getMinCap(this.$.blockchain.height);
        this.$vestingCurrentCap.textContent = Utils.satoshisToCoins(currentMinCap);
        this.$vestingCurrentlyTransferable.textContent = Utils.satoshisToCoins(Math.max(0, contract.balance - currentMinCap));
    }

    _updateHtlcDetails(contract) {
        this.$htlcSender.textContent = contract.sender.toUserFriendlyAddress();
        this.$htlcRecipient.textContent = contract.recipient.toUserFriendlyAddress();
        this.$htlcHashRoot.textContent = contract.hashRoot.toBase64();
        this.$htlcHashCount.textContent = contract.hashCount;
        this.$htlcTimeout.textContent = contract.timeout;
        this.$htlcTotalAmount.textContent = Utils.satoshisToCoins(contract.totalAmount);
    }
}
AccountInfoUi.ATTRIBUTE_ACCOUNT_TYPE = 'account-type';
AccountInfoUi.AccountType = {
    NOT_FOUND: 'not-found',
    UNKNOWN: 'unknown',
    BASIC: 'basic',
    VESTING: 'vesting',
    HTLC: 'htlc'
};
