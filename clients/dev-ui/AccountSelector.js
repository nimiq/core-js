class AccountSelector extends Nimiq.Observable {
    constructor(el, $) {
        super();
        if (el.nodeName.toLowerCase() !== 'select') {
            throw Error('AccountSelector must be a <select> node');
        }

        this.$el = el;
        this.$ = $;

        this.$el.addEventListener('change', () => this.fire('account-selected', this.selectedAddress));

        this._refreshList();
    }

    get selectedAddress() {
        try {
            return Nimiq.Address.fromUserFriendlyAddress(this.$el.value);
        } catch(e) {
            return null;
        }
    }

    set selectedAddress(address) {
        const userFriendlyAddress = address.toUserFriendlyAddress();
        this.$el.value = userFriendlyAddress;
        this.fire('account-selected', this.selectedAddress);
    }

    set includedTypes(types) {
        this.$el.setAttribute('include', types.join(' '));
        this._refreshList();
    }

    notifyAccountsChanged() {
        this._refreshList();
    }

    _refreshList() {
        const selected = this.$el.value;

        const includedTypes = this.$el.getAttribute('include');
        const includeWallets = !includedTypes || includedTypes.indexOf('wallet') !== -1;
        const includeVestingAccounts = !includedTypes || includedTypes.indexOf('vesting-account') !== -1;
        const includeHtlcAccounts = !includedTypes || includedTypes.indexOf('htlc-account') !== -1;
        const includePendingContracts = !includedTypes || includedTypes.indexOf('pending-account') !== -1;

        let walletAddressesPromise = includeWallets? this.$.walletStore.list() : Promise.resolve([]);
        walletAddressesPromise.then(walletAddresses => {
            this.$el.innerHTML = '';

            if (includeWallets) {
                this._createOptGroup(walletAddresses, 'Wallets');
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
            if (selected) this.$el.value = selected;
            else this._selectDefaultWallet();
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
        this.$.walletStore.hasDefault().then(hasDefault => {
            if (!hasDefault) return;
            this.$.walletStore.getDefault().then(wallet => this.selectedAddress = wallet.address);
        });
    }
}
