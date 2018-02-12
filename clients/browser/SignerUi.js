class SignerUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this.$el.innerHTML = SignerUi.html;
        this._signerAddress = null;
        this._signerAccount = null;
        this._signerType = null;

        this._conditionalShows = Array.prototype.slice.call(el.querySelectorAll('[show]'));

        this.$signerLabel = el.querySelector('[signer-label]');
        this._signerAccountSelector = new AccountSelector(el.querySelector('[signer-account]'), $);

        // create the child signer UIs on demand to avoid infinite recursion of children
        this._multiSigSignerUi = null;
        this._vestingOwnerSignerUi = null;
        this._htlcSignerUi = null;

        this._signerAccountSelector.on('account-selected', () => this._signerAccountChanged());
        this.$signerLabel.textContent = el.getAttribute('label') || 'Signer';
        this._showConditionalShows(SignerUi.SignerType.SINGLE_SIG);
    }

    static get html() {
        return `
            <div class="input-group">
                <label>
                    <strong signer-label></strong>
                    <select signer-account include="wallet multi-sig-wallet"></select>
                </label>
            </div>
        `;
    }

    set signerTypesToOffer(types) {
        const TYPE_MAP = new Map();
        TYPE_MAP.set(SignerUi.SignerType.SINGLE_SIG, AccountSelector.AccountType.WALLET);
        TYPE_MAP.set(SignerUi.SignerType.MULTI_SIG, AccountSelector.AccountType.MULTI_SIG_WALLET);
        TYPE_MAP.set(SignerUi.SignerType.VESTING, AccountSelector.AccountType.VESTING_ACCOUNT);
        TYPE_MAP.set(SignerUi.SignerType.HTLC, AccountSelector.AccountType.HTLC_ACCOUNT);
        types = types.map(type => TYPE_MAP.get(type));
        this._signerAccountSelector.includedTypes = types;
    }

    set selectedSigner(address) {
        this._signerAccountSelector.selectedAddress = address;
    }

    /** @async */
    getSigner() {
        switch (this._signerType) {
            case SignerUi.SignerType.SINGLE_SIG:
                return new SingleSigSigner(this.$, this._signerAddress);
            case SignerUi.SignerType.MULTI_SIG:
                return this._multiSigSignerUi.getSigner();
            case SignerUi.SignerType.VESTING:
                return this._vestingOwnerSignerUi.getSigner()
                    .then(vestingOwnerSigner => new VestingSigner(this.$, this._signerAddress, vestingOwnerSigner));
            case SignerUi.SignerType.HTLC:
                return this._htlcSignerUi.getSigner();
            default:
                return Promise.reject('Unknown Signer Type');
        }
    }

    notifyAccountsChanged() {
        this._signerAccountSelector.notifyAccountsChanged();
        if (this._multiSigSignerUi) {
            this._multiSigSignerUi.notifyAccountsChanged();
        }
        if (this._vestingOwnerSignerUi) {
            this._vestingOwnerSignerUi.notifyAccountsChanged();
        }
        if (this._htlcSignerUi) {
            this._htlcSignerUi.notifyAccountsChanged();
        }
    }

    _showConditionalShows(type) {
        this._conditionalShows.forEach(el => {
            if (el.getAttribute('show').indexOf(type) !== -1) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });
    }

    _signerAccountChanged() {
        this._signerAddress = this._signerAccountSelector.selectedAddress;
        Utils.getAccount(this.$, this._signerAddress)
        .then(account => {
            this._signerAccount = account;
            return this._getType(this._signerAddress, this._signerAccount);
        }).then(type => {
            this._signerType = type;
            switch (type) {
                case SignerUi.SignerType.SINGLE_SIG:
                    break;
                case SignerUi.SignerType.MULTI_SIG:
                    this._onTypeMultiSig();
                    break;
                case SignerUi.SignerType.VESTING:
                    this._onTypeVestingAccount();
                    break;
                case SignerUi.SignerType.HTLC:
                    this._onTypeHtlcAccount();
                    break;
                default:
                    alert('Unknown Account Type');
                    return;
            }
            this._showConditionalShows(type);
        });
    }

    /** @async */
    _getType(address, account) {
        return Promise.all([
            Utils.isBasicWalletAddress(this.$, address),
            Utils.isMultiSigWalletAddress(this.$, address)
        ]).then(promiseResults => {
            const isBasicWalletAddress = promiseResults[0];
            const isMultiSigWalletAddress = promiseResults[1];

            if (isBasicWalletAddress) {
                return SignerUi.SignerType.SINGLE_SIG;
            }
            if (isMultiSigWalletAddress) {
                return SignerUi.SignerType.MULTI_SIG;
            }

            const TYPE_MAP = new Map();
            TYPE_MAP.set(Nimiq.Account.Type.BASIC, SignerUi.SignerType.SINGLE_SIG);
            TYPE_MAP.set(Nimiq.Account.Type.VESTING, SignerUi.SignerType.VESTING);
            TYPE_MAP.set(Nimiq.Account.Type.HTLC, SignerUi.SignerType.HTLC);
            return TYPE_MAP.get(account.type);
        });
    }

    _onTypeMultiSig() {
        if (!this._multiSigSignerUi) {
            const el = document.createElement('div');
            el.setAttribute('show', SignerUi.SignerType.MULTI_SIG);
            this.$el.appendChild(el);
            this._conditionalShows.push(el);
            this._multiSigSignerUi = new MultiSigSignerUi(el, this.$);
        }
        this._multiSigSignerUi.address = this._signerAddress;
    }

    _onTypeVestingAccount() {
        if (!this._vestingOwnerSignerUi) {
            const el = document.createElement('div');
            el.setAttribute('show', SignerUi.SignerType.VESTING);
            el.setAttribute('label', 'Signing Vesting Owner');
            this.$el.appendChild(el);
            this._conditionalShows.push(el);
            this._vestingOwnerSignerUi = new SignerUi(el, this.$);
            this._vestingOwnerSignerUi.signerTypesToOffer =
                [SignerUi.SignerType.SINGLE_SIG, SignerUi.SignerType.MULTI_SIG];
        }
        this._vestingOwnerSignerUi.selectedSigner = this._signerAccount.owner;
    }

    _onTypeHtlcAccount() {
        if (!this._htlcSignerUi) {
            const el = document.createElement('div');
            el.setAttribute('show', SignerUi.SignerType.HTLC);
            this.$el.appendChild(el);
            this._conditionalShows.push(el);
            this._htlcSignerUi = new HtlcSignerUi(el, this.$);
        }
        this._htlcSignerUi.setAccount(this._signerAddress, this._signerAccount);
    }
}
SignerUi.SignerType = {
    SINGLE_SIG: 'single-sig',
    MULTI_SIG: 'multi-sig',
    VESTING: 'vesting',
    HTLC: 'htlc'
};
