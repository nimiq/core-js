class HtlcProofUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this._htlcAddress = null;

        this.$proofType = el.querySelector('[htlc-proof-type]');
        this._htlcSenderAccountSelector = new AccountSelector(el.querySelector('[htlc-proof-sender]'), $);
        this._htlcRecipientAccountSelector = new AccountSelector(el.querySelector('[htlc-proof-recipient]'), $);
        this.$hashAlgorithm  = el.querySelector('[htlc-proof-hash-algo]');
        this.$hashPreImage = el.querySelector('[htlc-proof-hash-pre-image]');
        this.$hashDepth = el.querySelector('[htlc-proof-hash-depth]');
        this.$hashCount = el.querySelector('[htlc-proof-hash-count]');

        this.$proofType.addEventListener('change',
            () => this.$el.setAttribute(HtlcProofUi.ATTRIBUTE_PROOF_TYPE, this.$proofType.value));
    }

    notifyAccountsChanged() {
        this._htlcSenderAccountSelector.notifyAccountsChanged();
        this._htlcRecipientAccountSelector.notifyAccountsChanged();
    }

    setAccount(address, account) {
        if (account.type !== Nimiq.Account.Type.HTLC) throw Error('Not a HTLC account');
        this._htlcAddress = address;
        this._htlcSenderAccountSelector.selectedAddress = account.sender;
        this._htlcRecipientAccountSelector.selectedAddress = account.recipient;
    }

    /* async */
    getSender() {
        let proofType;
        switch (this.$proofType.value) {
            case HtlcProofUi.ProofType.REGULAR_TRANSFER:
                proofType = Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER;
                break;
            case HtlcProofUi.ProofType.EARLY_RESOLVE:
                proofType = Nimiq.HashedTimeLockedContract.ProofType.EARLY_RESOLVE;
                break;
            case HtlcProofUi.ProofType.TIMEOUT_RESOLVE:
                proofType = Nimiq.HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE;
                break;
        }
        const hashAlgorithm = Nimiq.Hash.Algorithm[this.$hashAlgorithm.value.toUpperCase()];
        const hashPreImage = this.$hashPreImage.value;
        const hashDepth = Utils.readNumber(this.$hashDepth);
        const hashCount = Utils.readNumber(this.$hashCount);
        const htlcSender = this._htlcSenderAccountSelector.selectedAddress;
        const htlcRecipient = this._htlcRecipientAccountSelector.selectedAddress;
        return new HtlcSender(this._htlcAddress, this.$, proofType, hashAlgorithm, hashPreImage, hashDepth, hashCount,
            htlcSender, htlcRecipient);
    }
}
HtlcProofUi.ATTRIBUTE_PROOF_TYPE = 'htlc-proof-type';
HtlcProofUi.ProofType = {
    REGULAR_TRANSFER: 'regular-transfer',
    EARLY_RESOLVE: 'early-resolve',
    TIMEOUT_RESOLVE: 'timeout-resolve'
};
