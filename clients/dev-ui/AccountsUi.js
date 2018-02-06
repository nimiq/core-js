class AccountsUi extends Nimiq.Observable {
    constructor(el, $) {
        super();
        this.$el = el;
        this.$ = $;
        this._vestingAccountList = new LocalStorageList(LocalStorageList.KEY_VESTING_ACCOUNT_LIST);
        this._htlcAccountList = new LocalStorageList(LocalStorageList.KEY_HTLC_ACCOUNT_LIST);
        this._pendingContractsList = new LocalStorageList(LocalStorageList.KEY_PENDING_CONTRACTS_LIST);

        this.$walletList = this.$el.querySelector('[wallet-list]');
        this.$vestingAccountList = this.$el.querySelector('[vesting-account-list]');
        this.$htlcAccountList = this.$el.querySelector('[htlc-account-list]');
        this.$pendingContractsList = this.$el.querySelector('[pending-contracts-list]');

        this.$walletAddButton = this.$el.querySelector('[wallet-add-button]');
        this.$walletAddButton.addEventListener('click', () => this._addWallet());

        this._initLists();
    }

    /** @async */
    addAccount(address) {
        return this._addOrRemoveAccount(address, true);
    }

    /** @async */
    removeAccount(address) {
        return this._addOrRemoveAccount(address, false);
    }

    _addOrRemoveAccount(address, add) {
        return Promise.all([
            Utils.getAccount(this.$, address),
            this._isWalletAddress(address)
        ]).then(promiseResults => {
            const account = promiseResults[0];
            const isWalletAddress = promiseResults[1];

            const list = this._getList(isWalletAddress, account.type);
            const userFriendlyAddress = address.toUserFriendlyAddress();
            if (add) {
                this._addToList(list.listEl, address);
                if (list.localStorageList) list.localStorageList.add(userFriendlyAddress);
                if (account.isInitial() && !isWalletAddress) this._checkPendingContract(address);
                return Promise.resolve();
            } else {
                this._removeFromList(list.listEl, address);
                if (list.localStorageList) list.localStorageList.remove(userFriendlyAddress);
                if (isWalletAddress) return this.$.walletStore.remove(address);
                else return Promise.resolve();
            }
        }).then(() => this.fire('accounts-changed'));
    }

    _addToList($list, address) {
        const userFriendlyAddress = address.toUserFriendlyAddress();
        if ($list.querySelector(`[value="${userFriendlyAddress}"]`)) return;
        const $listEntry = document.createElement('div');
        $listEntry.classList.add('list-entry');
        $listEntry.setAttribute('value', userFriendlyAddress);
        const $content = document.createElement('div');
        $content.className = 'address';
        $content.textContent = userFriendlyAddress;
        $content.addEventListener('click', () => this.fire('account-selected', address));
        $listEntry.appendChild($content);
        const $deleteButton = document.createElement('div');
        $deleteButton.classList.add('list-entry-delete');
        $deleteButton.addEventListener('click', () => {
            if (!confirm('Do you really want to remove this account?')) return;
            this.removeAccount(address);
        });
        $listEntry.appendChild($deleteButton);
        $list.appendChild($listEntry);
    }

    _removeFromList($list, address) {
        const userFriendlyAddress = address.toUserFriendlyAddress();
        const entry = $list.querySelector(`[value="${userFriendlyAddress}"]`);
        if (!entry) return;
        $list.removeChild(entry);
    }

    _clearList($list) {
        $list.innerHTML = '';
    }

    _fillList($list, addresses) {
        this._clearList($list);
        addresses.forEach(address => this._addToList($list, address));
    }

    _getList(isWalletAddress, accountType) {
        let localStorageList = null, listEl = null;
        switch (accountType) {
            case Nimiq.Account.Type.VESTING:
                localStorageList = this._vestingAccountList;
                listEl = this.$vestingAccountList;
                break;
            case Nimiq.Account.Type.HTLC:
                localStorageList = this._htlcAccountList;
                listEl = this.$htlcAccountList;
                break;
            case Nimiq.Account.Type.BASIC:
                if (isWalletAddress) {
                    listEl = this.$walletList;
                } else {
                    localStorageList = this._pendingContractsList;
                    listEl = this.$pendingContractsList;
                }
                break;
        }
        return {
            localStorageList: localStorageList,
            listEl: listEl
        };
    }

    _addWallet() {
        let wallet;
        Nimiq.Wallet.generate()
            .then(wlt => {
                wallet = wlt;
                return this.$.walletStore.put(wallet);
            })
            .then(() => this.$.walletStore.list())
            .then(walletAddresses => {
                if (walletAddresses.length === 1) {
                    // the newly created wallet is the only one, make it the default
                    return this.$.walletStore.setDefault(wallet.address);
                }
                return Promise.resolve();
            })
            .then(() => this.addAccount(wallet.address))
            .catch(alert);
    }

    /** async */
    _isWalletAddress(address) {
        return this.$.walletStore.list().then(walletAddresses => {
            for (let i=0; i<walletAddresses.length; ++i) {
                if (address.equals(walletAddresses[i])) return true;
            }
            return false;
        });
    }

    _initLists() {
        this.$.walletStore.list().then(addresses => {
            this._fillList(this.$walletList, addresses);
        }).catch(alert);

        this._fillList(this.$vestingAccountList,
            this._vestingAccountList.get().map(userFriendly => Nimiq.Address.fromUserFriendlyAddress(userFriendly)));
        this._fillList(this.$htlcAccountList,
            this._htlcAccountList.get().map(userFriendly => Nimiq.Address.fromUserFriendlyAddress(userFriendly)));

        const pendingContractAddresses =
            this._pendingContractsList.get().map(userFriendly => Nimiq.Address.fromUserFriendlyAddress(userFriendly));
        this._fillList(this.$pendingContractsList, pendingContractAddresses);
        pendingContractAddresses.forEach(address => this._checkPendingContract(address));
    }

    _checkPendingContract(address) {
        const check = () => {
            Utils.getAccount(this.$, address).then(account => {
                if (account.isInitial()) return; // still not mined
                // readd the account to sort it into the correct category
                this._removeFromList(this.$pendingContractsList, address);
                this._pendingContractsList.remove(address.toUserFriendlyAddress());
                this.addAccount(address);
                this.$.blockchain.off('head-changed', check);
            });
        };
        this.$.blockchain.on('head-changed', check);
        check();
    }
}


class LocalStorageList {
    constructor(key) {
        this._key = key;
    }

    get() {
        const localStorageData = localStorage[this._key];
        if (!localStorageData) return [];
        return JSON.parse(localStorageData);
    }

    set(list) {
        localStorage[this._key] = JSON.stringify(list);
    }

    add(entry) {
        const list = this.get();
        if (list.indexOf(entry) !== -1) return false;
        list.push(entry);
        this.set(list);
        return true;
    }

    remove(entry) {
        const list = this.get();
        const index = list.indexOf(entry);
        if (index === -1) return false;
        list.splice(index, 1);
        this.set(list);
        return true;
    }
}
LocalStorageList.KEY_VESTING_ACCOUNT_LIST = 'vesting-account-list';
LocalStorageList.KEY_HTLC_ACCOUNT_LIST = 'htlc-account-list';
LocalStorageList.KEY_PENDING_CONTRACTS_LIST = 'pending-contracts-list';
