class MultiSigWalletCreationUi extends Nimiq.Observable {
    constructor(el, $) {
        super();
        this.$el = el;
        this.$ = $;

        el.innerHTML = MultiSigWalletCreationUi.html;
        this.$pageStart = el.querySelector('[page-start]');
        this.$buttonStartCreation = el.querySelector('[button-start-creation]');

        this.$pageParameters = el.querySelector('[page-parameters]');
        this.$signerCount = el.querySelector('[signer-count]');
        this.$requiredSignerCount = el.querySelector('[required-signer-count]');
        this.$buttonSetParameters = el.querySelector('[button-set-parameters]');

        this.$pageSignersSelect = el.querySelector('[page-signers-select]');
        this.$signerAccountSelectors = el.querySelector('[signer-account-selectors]');
        this.$buttonReset = el.querySelector('[button-reset]');
        this.$buttonCreate = el.querySelector('[button-create]');

        this.$buttonStartCreation.addEventListener('click', () => this._showPage(this.$pageParameters));
        this.$buttonSetParameters.addEventListener('click', () => this._setParameters());
        this.$buttonReset.addEventListener('click', () => this.reset());
        this.$buttonCreate.addEventListener('click', () => this._createMultiSig());

        this.reset();
    }

    static get html() {
        return `
            <div page-start>
                <button button-start-creation>Add</button>
            </div>
            <div page-parameters>
                <div class="input-group">
                    <label>
                        <strong>Number of Signers</strong>
                        <input signer-count type="number" step="1">
                    </label>
                </div>
                <div class="input-group">
                    <label>
                        <strong>Required for Signing</strong>
                        <input required-signer-count type="number" step="1">
                    </label>
                </div>
                <div class="input-group">
                    <button button-set-parameters>Next</button>
                </div>
            </div>
            <div page-signers-select>
                <div class="input-group" signer-account-selectors></div>
                <div class="input-group">
                    <button button-reset>Reset</button>
                    <button button-create>Create</button>
                </div>
            </div>
        `;
    }

    notifyAccountsChanged() {
        this._signerSelectors.forEach(selector => selector.notifyAccountsChanged());
    }

    reset() {
        this._requiredSignerCount = 0;
        this._signerSelectors = [];
        this.$signerCount.value = '';
        this.$requiredSignerCount.value = '';
        this.$signerAccountSelectors.innerHTML = '';
        this._showPage(this.$pageStart);
    }

    _showPage(page) {
        const pages = [this.$pageStart, this.$pageParameters, this.$pageSignersSelect];
        pages.filter(p => p !== page).forEach(page => page.style.display = 'none');
        page.style.display = 'block';
    }

    _setParameters() {
        const signerCount = Utils.readNumber(this.$signerCount);
        const requiredSignerCount = Utils.readNumber(this.$requiredSignerCount);
        if (signerCount === null || requiredSignerCount === null) return;
        this._requiredSignerCount = requiredSignerCount;

        for (let i=0; i<signerCount; ++i) {
            const $selector = document.createElement('select');
            $selector.setAttribute('include', 'wallet');
            const selector = new AccountSelector($selector, this.$);
            this._signerSelectors.push(selector);
            this.$signerAccountSelectors.append($selector);
        }

        this._showPage(this.$pageSignersSelect);
    }

    _createMultiSig() {
        const signerWalletAddresses = this._signerSelectors.map(selector => selector.selectedAddress);
        if (signerWalletAddresses.some(address => address === null)) {
            alert('Please provide all involved accounts.');
            return;
        }
        let multiSigWallet;
        const signerWalletPromises = signerWalletAddresses.map(address => this.$.walletStore.get(address));
        Promise.all(signerWalletPromises).then(signerWallets => {
            const publicKeys = signerWallets.map(wallet => wallet.keyPair.publicKey);
            multiSigWallet = Nimiq.MultiSigWallet.fromPublicKeys(signerWallets[0].keyPair, this._requiredSignerCount,
                publicKeys);
            return this.$.walletStore.putMultiSig(multiSigWallet);
        }).then(() => {
            this.reset();
            this.fire('multi-sig-wallet-created', multiSigWallet);
        });
    }
}
