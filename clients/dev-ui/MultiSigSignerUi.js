class MultiSigSignerUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this._address = null;
        this._signerAccountSelectors = [];

        el.innerHTML = MultiSigSignerUi.html;

        this.$signerCount = el.querySelector('[signer-count]');
        this.$signerAccountSelectors = el.querySelector('[signer-account-selectors]');

        this.$signerCount.addEventListener('input', () => this._updateNumberOfSigners(this.$signerCount.value));
    }

    static get html() {
        return `
            <div class="input-group">
                <label>
                    <strong>Number of Signers</strong>
                    <input signer-count type="number" step="1">
                </label>
            </div>
            <div class="input-group">
                <label>
                    <strong>MultiSig Signers</strong>
                    <div signer-account-selectors style="display: inline-block;"></div>
                </label>
            </div>
        `;
    }

    /** @async */
    getSigner() {
        const signingAddresses = this._signerAccountSelectors.map(selector => selector.selectedAddress);
        return new MultiSigSigner(this.$, this._address, signingAddresses);
    }

    notifyAccountsChanged() {
        this._signerAccountSelectors.forEach(selector => selector.notifyAccountsChanged());
    }

    set address(address) {
        this._address = address;
        this.$.walletStore.getMultiSig(address).then(wallet => {
            this._updateNumberOfSigners(wallet.minSignatures);
        }).catch(); // if we don't have this wallet, just ignore
    }

    _updateNumberOfSigners(number) {
        this.$signerCount.value = number;
        // add if needed
        while (this._signerAccountSelectors.length < number) {
            const selectorEl = document.createElement('select');
            const selector = new AccountSelector(selectorEl, this.$);
            selector.includedTypes = [AccountSelector.AccountType.WALLET];
            this._signerAccountSelectors.push(selector);
            this.$signerAccountSelectors.appendChild(selectorEl);
        }
        // remove if needed
        while (this._signerAccountSelectors.length > number) {
            this._signerAccountSelectors.splice(-1, 1); // remove last entry
            this.$signerAccountSelectors.removeChild(this.$signerAccountSelectors.lastElementChild);
        }
    }
}
