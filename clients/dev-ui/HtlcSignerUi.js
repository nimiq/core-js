class HtlcSignerUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this.$el.innerHTML = HtlcSignerUi.html;
        this._htlcAddress = null;

        this._conditionalShows = el.querySelectorAll('[show]');

        this.$proofType = el.querySelector('[htlc-proof-type]');
        this.$hashAlgorithm  = el.querySelector('[htlc-proof-hash-algo]');
        this.$hashPreImage = el.querySelector('[htlc-proof-hash-pre-image]');
        this.$hashDepth = el.querySelector('[htlc-proof-hash-depth]');
        this.$hashCount = el.querySelector('[htlc-proof-hash-count]');

        this._htlcSenderSigner = new SignerUi(el.querySelector('[htlc-proof-sender]'), $);
        this._htlcRecipientSigner = new SignerUi(el.querySelector('[htlc-proof-recipient]'), $);
        this._htlcSenderSigner.signerTypesToOffer = [SignerUi.SignerType.SINGLE_SIG, SignerUi.SignerType.MULTI_SIG];
        this._htlcRecipientSigner.signerTypesToOffer = [SignerUi.SignerType.SINGLE_SIG, SignerUi.SignerType.MULTI_SIG];

        this.$proofType.addEventListener('change', () => this._updateConditionalShows());
        this.$proofType.value = HtlcSignerUi.ProofType.REGULAR_TRANSFER;
        this._updateConditionalShows();
    }

    static get html() {
        return `
            <div class="input-group">
                <label>
                    <strong>HTLC Proof Type</strong>
                    <select htlc-proof-type>
                        <option value="regular-transfer" selected>Regular Transfer</option>
                        <option value="early-resolve">Early Resolve</option>
                        <option value="timeout-resolve">Timeout Resolve</option>
                    </select>
                </label>
            </div>
            <div htlc-proof-sender label="Signing HTLC Sender" show="timeout-resolve early-resolve"></div>
            <div htlc-proof-recipient label="Signing HTLC Recipient" show="regular-transfer early-resolve"></div>
            <div show="regular-transfer">
                <div class="input-group">
                    <label>
                        <strong>Proof Hash Algorithm</strong>
                        <select htlc-proof-hash-algo>
                            <option value="blake2b" selected>Blake2b</option>
                            <option value="sha256">Sha256</option>
                        </select>
                    </label>
                </div>
                <div class="input-group">
                    <label>
                        <strong>Proof Hash Pre-Image</strong>
                        <input htlc-proof-hash-pre-image name="htlc-proof-hash-pre-image" size="45">
                    </label>
                </div>
                <div class="input-group">
                    <label>
                        <strong>Proof Hash Depth</strong>
                        <input htlc-proof-hash-depth name="htlc-proof-hash-depth" type="number">
                    </label>
                </div>
                <div class="input-group">
                    <label>
                        <strong>Proof Hash Count</strong>
                        <input htlc-proof-hash-count name="htlc-proof-hash-count" type="number">
                    </label>
                </div>
            </div>
        `;
    }

    notifyAccountsChanged() {
        this._htlcSenderSigner.notifyAccountsChanged();
        this._htlcRecipientSigner.notifyAccountsChanged();
    }

    setAccount(address, account) {
        if (account.type !== Nimiq.Account.Type.HTLC) throw Error('Not a HTLC account');
        this._htlcAddress = address;
        this._htlcSenderSigner.selectedSigner = account.sender;
        this._htlcRecipientSigner.selectedSigner = account.recipient;
    }

    /** @async */
    getSigner() {
        let proofType;
        switch (this.$proofType.value) {
            case HtlcSignerUi.ProofType.REGULAR_TRANSFER:
                proofType = Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER;
                break;
            case HtlcSignerUi.ProofType.EARLY_RESOLVE:
                proofType = Nimiq.HashedTimeLockedContract.ProofType.EARLY_RESOLVE;
                break;
            case HtlcSignerUi.ProofType.TIMEOUT_RESOLVE:
                proofType = Nimiq.HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE;
                break;
        }
        const hashAlgorithm = Nimiq.Hash.Algorithm[this.$hashAlgorithm.value.toUpperCase()];
        const hashPreImage = this.$hashPreImage.value;
        const hashDepth = Utils.readNumber(this.$hashDepth);
        const hashCount = Utils.readNumber(this.$hashCount);
        return Promise.all([
            this._htlcSenderSigner.getSigner(),
            this._htlcRecipientSigner.getSigner()
        ]).then(promiseResults => {
            const htlcSenderSigner = promiseResults[0];
            const htlcRecipientSigner = promiseResults[1];
            return new HtlcSigner(this.$, this._htlcAddress, proofType, hashAlgorithm, hashPreImage, hashDepth,
                hashCount, htlcSenderSigner, htlcRecipientSigner);
        });
    }

    _updateConditionalShows() {
        this._conditionalShows.forEach(el => {
            if (el.getAttribute('show').indexOf(this.$proofType.value) !== -1) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });
    }
}
HtlcSignerUi.ProofType = {
    REGULAR_TRANSFER: 'regular-transfer',
    EARLY_RESOLVE: 'early-resolve',
    TIMEOUT_RESOLVE: 'timeout-resolve'
};
