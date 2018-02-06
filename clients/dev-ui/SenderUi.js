class SenderUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this._senderAddress = null;
        this._senderAccount = null;

        this._senderAccountSelector = new AccountSelector(el.querySelector('[sender-account]'), $);
        this._vestingOwnerAccountSelector = new AccountSelector(el.querySelector('[sender-vesting-owner]'), $);
        this._htlcProofUi = new HtlcProofUi(el.querySelector('[htlc-proof-ui]'), $);

        this._senderAccountSelector.$el.addEventListener('change', () => this._senderAccountChanged());
    }

    /* async */
    getSender() {
        switch (this._senderAccount.type) {
            case Nimiq.Account.Type.BASIC:
                return new WalletSender(this._senderAddress, this.$);
            case Nimiq.Account.Type.VESTING:
                return new VestingSender(this._senderAddress, this.$, this._vestingOwnerAccountSelector.selectedAddress);
            case Nimiq.Account.Type.HTLC:
                return this._htlcProofUi.getSender();
            default:
                alert('Unknown Account Type');
                return Promise.reject();
        }
    }

    setSenderTypesToOffer(types) {
        this._senderAccountSelector.includedTypes = types;
    }

    notifyAccountsChanged() {
        this._senderAccountSelector.notifyAccountsChanged();
        this._vestingOwnerAccountSelector.notifyAccountsChanged();
        this._htlcProofUi.notifyAccountsChanged();
    }

    _senderAccountChanged() {
        this._senderAddress = this._senderAccountSelector.selectedAddress;
        Utils.getAccount(this.$, this._senderAddress).then(account => {
            this._senderAccount = account;
            switch (account.type) {
                case Nimiq.Account.Type.BASIC:
                    this._onTypeWallet();
                    break;
                case Nimiq.Account.Type.VESTING:
                    this._onTypeVestingAccount();
                    break;
                case Nimiq.Account.Type.HTLC:
                    this._onTypeHtlcAccount();
                    break;
                default:
                    alert('Unknown Account Type');
                    return;
            }
        });
    }

    _onTypeWallet() {
        this.$el.setAttribute(SenderUi.ATTRIBUTE_SENDER_TYPE, SenderUi.SenderType.WALLET);
    }

    _onTypeVestingAccount() {
        this.$el.setAttribute(SenderUi.ATTRIBUTE_SENDER_TYPE, SenderUi.SenderType.VESTING_ACCOUNT);
        this._vestingOwnerAccountSelector.selectedAddress = this._senderAccount.owner;
    }

    _onTypeHtlcAccount() {
        this.$el.setAttribute(SenderUi.ATTRIBUTE_SENDER_TYPE, SenderUi.SenderType.HTLC_ACCOUNT);
        this._htlcProofUi.setAccount(this._senderAddress, this._senderAccount);
    }
}
SenderUi.ATTRIBUTE_SENDER_TYPE = 'sender-type';
SenderUi.SenderType = {
    WALLET: 'wallet',
    VESTING_ACCOUNT: 'vesting-account',
    HTLC_ACCOUNT: 'htlc-account'
};
