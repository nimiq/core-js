class AccountInfoUi {
    constructor(el, $) {
        this.$el = el;
        this.$addressInput = this.$el.querySelector('[address-input]');
        this.$clearButton = this.$el.querySelector('[clear-button]');
        this.$address = this.$el.querySelector('[address]');
        this.$balance = this.$el.querySelector('[balance]');

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
        this.$.blockchain.on('head-changed', () => this._update());
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
            address = Address.fromUserFriendlyAddress(userFriendlyAddress);
        } catch(e) {
            this.$addressInput.classList.add('error');
            return;
        }
        this.$addressInput.classList.remove('error');
        this._setAddress(address);
    }

    _update() {
        if (this.$.clientType === DevUI.CLIENT_NANO && !$.consensus.established) {
            return; // updates are expensive on nano, so don't do it till consensus
        }
        Utils.getAccount(this.$, this._address).then(account => {
            if (!account) {
                this.$el.setAttribute(AccountInfoUi.ATTRIBUTE_ACCOUNT_TYPE, AccountInfoUi.AccountType.NOT_FOUND);
                return;
            }
            this.$balance.textContent = Utils.toFixedPrecision(account.balance);
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

    _updateVestingDetails(account) {
        this.$vestingStart.textContent = account.vestingStart;
        this.$vestingStepBlocks.textContent = account.vestingStepBlocks;
        this.$vestingStepAmount.textContent = Utils.toFixedPrecision(account.vestingStepAmount);
        this.$vestingTotalAmount.textContent = Utils.toFixedPrecision(account.vestingTotalAmount);
        const currrentMinCap = account._vestingStepBlocks && account._vestingStepAmount > 0
            ? Math.max(0, account._vestingTotalAmount - Math.floor((this.$.blockchain.height - account._vestingStart) / account._vestingStepBlocks) * account._vestingStepAmount)
            : 0; // TODO there should be a method in VestingAccount.js that calculates this value
        this.$vestingCurrentCap.textContent = Utils.toFixedPrecision(currrentMinCap);
        this.$vestingCurrentlyTransferable.textContent = Utils.toFixedPrecision(Math.max(0, account.balance - currrentMinCap));
    }

    _updateHtlcDetails(account) {
        this.$htlcSender.textContent = account.sender.toUserFriendlyAddress();
        this.$htlcRecipient.textContent = account.recipient.toUserFriendlyAddress();
        this.$htlcHashRoot.textContent = account.hashRoot.toBase64();
        this.$htlcHashCount.textContent = account.hashCount;
        this.$htlcTimeout.textContent = account.timeout;
        this.$htlcTotalAmount.textContent = Utils.toFixedPrecision(account.totalAmount);
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
