class AccountSelector extends Nimiq.Observable {
    constructor(el, $) {
        super();
        if (el.nodeName.toLowerCase() !== 'select') {
            throw Error('AccountSelector must be a <select> node');
        }

        this.$el = el;
        this.$ = $;

        this.$el.addEventListener('change', () => this.fire('account-selected', this.selectedAddress));

        this._awaitRefresh = this._refreshList();
    }

    get selectedAddress() {
        try {
            return Nimiq.Address.fromUserFriendlyAddress(this.$el.value);
        } catch(e) {
            return null;
        }
    }

    set selectedAddress(address) {
        // await refresh to be able to select one of the new options
        this._awaitRefresh.then(() => this._selectAddressWithoutWaiting(address));
    }

    _selectAddressWithoutWaiting(address) {
        const userFriendlyAddress = address.toUserFriendlyAddress();
        this.$el.value = userFriendlyAddress;
        this.fire('account-selected', this.selectedAddress);
    }

    set includedTypes(types) {
        this.$el.setAttribute('include', types.join(' '));
        this._awaitRefresh = this._refreshList();
    }

    notifyAccountsChanged() {
        this._awaitRefresh = this._refreshList();
    }

    _refreshList() {
        const includedTypes = this.$el.getAttribute('include');
        const includeWallets = !includedTypes
            || includedTypes.indexOf(AccountSelector.AccountType.WALLET) !== -1;
        const includeMultiSigWallets = !includedTypes
            || includedTypes.indexOf(AccountSelector.AccountType.MULTI_SIG_WALLET) !== -1;
        const includeVestingAccounts = !includedTypes
            || includedTypes.indexOf(AccountSelector.AccountType.VESTING_ACCOUNT) !== -1;
        const includeHtlcAccounts = !includedTypes
            || includedTypes.indexOf(AccountSelector.AccountType.HTLC_ACCOUNT) !== -1;
        const includePendingContracts = !includedTypes
            || includedTypes.indexOf(AccountSelector.AccountType.PENDING_ACCOUNT) !== -1;

        return Promise.all([
            includeWallets? this.$.walletStore.list() : Promise.resolve([]),
            includeMultiSigWallets? this.$.walletStore.listMultiSig() : Promise.resolve([])
        ]).then(promiseResults => {
            const walletAddresses = promiseResults[0];
            const multiSigWalletAddresses = promiseResults[1];

            const selected = this.$el.value;
            this.$el.innerHTML = '';

            if (includeWallets) {
                this._createOptGroup(walletAddresses, 'Wallets');
            }
            if (includeMultiSigWallets) {
                this._createOptGroup(multiSigWalletAddresses, 'MultiSig Wallets');
            }
            if (includeVestingAccounts) {
                const vestingAddresses = this._getAddressesFromLocalStorage(LocalStorageList.KEY_VESTING_ACCOUNT_LIST);
                this._createOptGroup(vestingAddresses, 'Vesting Accounts');
            }
            if (includeHtlcAccounts) {
                const htlcAddresses = this._getAddressesFromLocalStorage(LocalStorageList.KEY_HTLC_ACCOUNT_LIST);
                this._createOptGroup(htlcAddresses, 'HTLC Accounts');
            }
            if (includePendingContracts) {
                const pendingAddresses = this._getAddressesFromLocalStorage(LocalStorageList.KEY_PENDING_CONTRACTS_LIST);
                this._createOptGroup(pendingAddresses, 'Pending Contracts');
            }
            if (selected) {
                this.$el.value = selected;
                return Promise.resolve();
            }
            return this._selectDefaultWallet();
        });
    }

    _createOptGroup(addresses, label) {
        if (addresses.length === 0) return;
        const optGroup = document.createElement('optgroup');
        optGroup.setAttribute('label', label);
        addresses.forEach(address => this._createEntry(address, optGroup));
        this.$el.appendChild(optGroup);
    }

    _createEntry(address, optGroup) {
        const entry = document.createElement('option');
        const userFriendlyAddress = address.toUserFriendlyAddress();
        entry.setAttribute('value', userFriendlyAddress);
        entry.textContent = userFriendlyAddress;
        optGroup.appendChild(entry);
    }

    _getAddressesFromLocalStorage(key) {
        return new LocalStorageList(key).get().map(userFriendly => Nimiq.Address.fromUserFriendlyAddress(userFriendly));
    }

    _selectDefaultWallet() {
        return this.$.walletStore.hasDefault().then(hasDefault => {
            if (!hasDefault) return Promise.resolve();
            return this.$.walletStore.getDefault().then(wallet => this._selectAddressWithoutWaiting(wallet.address));
        });
    }
}
AccountSelector.AccountType = {
    WALLET: 'wallet',
    MULTI_SIG_WALLET: 'multi-sig-wallet',
    VESTING_ACCOUNT: 'vesting-account',
    HTLC_ACCOUNT: 'htlc-account',
    PENDING_ACCOUNT: 'pending-account'
};
