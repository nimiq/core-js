class AccountsUi extends Nimiq.Observable {
    constructor(el, $) {
        super();
        this.$el = el;
        this.$ = $;
        this._vestingAccountList = new LocalStorageList(LocalStorageList.KEY_VESTING_ACCOUNT_LIST);
        this._htlcAccountList = new LocalStorageList(LocalStorageList.KEY_HTLC_ACCOUNT_LIST);
        this._pendingContractsList = new LocalStorageList(LocalStorageList.KEY_PENDING_CONTRACTS_LIST);

        this.$basicWalletList = this.$el.querySelector('[basic-wallet-list]');
        this.$multiSigWalletList = this.$el.querySelector('[multi-sig-wallet-list]');
        this.$vestingAccountList = this.$el.querySelector('[vesting-account-list]');
        this.$htlcAccountList = this.$el.querySelector('[htlc-account-list]');
        this.$pendingContractsList = this.$el.querySelector('[pending-contracts-list]');

        this.$addBasicWallet = this.$el.querySelector('[add-basic-wallet]');
        this.$addBasicWallet.addEventListener('click', () => this._addWallet());

        this._multiSigWalletCreationUi =
            new MultiSigWalletCreationUi(el.querySelector('[multi-sig-wallet-creation-ui]'), $);
        this._multiSigWalletCreationUi.on('multi-sig-wallet-created', wallet => this.addAccount(wallet.address));

        this._initLists();
    }

    notifyAccountsChanged() {
        this._multiSigWalletCreationUi.notifyAccountsChanged();
    }

    /** @async */
    addAccount(address) {
        return this._addOrRemoveAccount(address, true);
    }

    /** @async */
    removeAccount(address) {
        return this._addOrRemoveAccount(address, false);
    }

    /** @async */
    _addOrRemoveAccount(address, add) {
        return Promise.all([
            Utils.isBasicWalletAddress(this.$, address),
            Utils.isMultiSigWalletAddress(this.$, address)
        ]).then(promiseResults => {
            const isBasicWalletAddress = promiseResults[0];
            const isMultiSigWalletAddress = promiseResults[1];

            if (add) {
                return this._addAccount(address, isBasicWalletAddress, isMultiSigWalletAddress);
            } else {
                return this._removeAccount(address, isBasicWalletAddress, isMultiSigWalletAddress);
            }
        }).then(() => {
            this._updateNanoSubscriptions();
            this.fire('accounts-changed');
        });
    }

    _addAccount(address, isBasicWalletAddress, isMultiSigWalletAddress) {
        if (isBasicWalletAddress) {
            this._addToList(this.$basicWalletList, address);
            return Promise.resolve(); // already added to wallet store
        }
        if (isMultiSigWalletAddress) {
            this._addToList(this.$multiSigWalletList, address);
            return Promise.resolve(); // already added to wallet store
        }
        // address is a contract
        return Utils.getAccount(this.$, address).then(account => {
            const list = this._getContractList(account.type);
            this._addToList(list.listEl, address);
            list.localStorageList.add(address.toUserFriendlyAddress());
            if (account.isInitial()) this._checkPendingContract(address);
        });
    }

    _removeAccount(address, isBasicWalletAddress, isMultiSigWalletAddress) {
        if (isBasicWalletAddress) {
            this._removeFromList(this.$basicWalletList, address);
            return this.$.walletStore.remove(address);
        }
        if (isMultiSigWalletAddress) {
            this._removeFromList(this.$multiSigWalletList, address);
            return this.$.walletStore.removeMultiSig(address);
        }
        // removal of a contract. try to remove from all lists because after a contract moved to another
        // category (e.g. if not pending anymore or if pruned after emptied out) we don't know the previous list
        const userFriendlyAddress = address.toUserFriendlyAddress();
        [this._vestingAccountList, this._htlcAccountList, this._pendingContractsList].forEach(list =>
            list.remove(userFriendlyAddress));
        [this.$vestingAccountList, this.$htlcAccountList, this.$pendingContractsList].forEach(list =>
            this._removeFromList(list, address));
        return Promise.resolve();
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

    _getContractList(contractType) {
        let localStorageList, listEl;
        switch (contractType) {
            case Nimiq.Account.Type.VESTING:
                localStorageList = this._vestingAccountList;
                listEl = this.$vestingAccountList;
                break;
            case Nimiq.Account.Type.HTLC:
                localStorageList = this._htlcAccountList;
                listEl = this.$htlcAccountList;
                break;
            case Nimiq.Account.Type.BASIC:
                localStorageList = this._pendingContractsList;
                listEl = this.$pendingContractsList;
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
            .then(() => this.addAccount(wallet.address));
    }

    _initLists() {
        this.$.walletStore.list().then(addresses => {
            this._fillList(this.$basicWalletList, addresses);
        });
        this.$.walletStore.listMultiSig().then(addresses => {
            this._fillList(this.$multiSigWalletList, addresses);
        });

        this._fillList(this.$vestingAccountList, this._userFriendlyAddressesToAddresses(this._vestingAccountList.get()));
        this._fillList(this.$htlcAccountList, this._userFriendlyAddressesToAddresses(this._htlcAccountList.get()));

        const pendingContractAddresses = this._userFriendlyAddressesToAddresses(this._pendingContractsList.get());
        this._fillList(this.$pendingContractsList, pendingContractAddresses);
        pendingContractAddresses.forEach(address => this._checkPendingContract(address));

        this._updateNanoSubscriptions();
        Utils.awaitConsensus(this.$).then(() => this._checkForPrunedContracts());
    }

    _userFriendlyAddressesToAddresses(userFriendlyAddresses) {
        return userFriendlyAddresses.map(userFriendly => Nimiq.Address.fromUserFriendlyAddress(userFriendly));
    }

    _checkPendingContract(address) {
        const check = () => {
            Utils.getAccount(this.$, address).then(account => {
                if (account.isInitial()) return; // still not mined
                // readd the account to sort it into the correct category
                this.removeAccount(address).then(() => this.addAccount(address));
                this.$.blockchain.off('head-changed', check);
            });
        };
        this.$.blockchain.on('head-changed', check);
        check();
    }

    _checkForPrunedContracts() {
        // remove contracts that were emptied out and then got pruned (and thus are basic accounts now)
        [].concat(
            this._userFriendlyAddressesToAddresses(this._vestingAccountList.get()),
            this._userFriendlyAddressesToAddresses(this._htlcAccountList.get())
        ).forEach(address => {
            Utils.getAccount(this.$, address).then(account => {
                if (account.isInitial()) this.removeAccount(address);
            });
        });
    }

    /** @async */
    _getAddresses() {
        return Promise.all([
            this.$.walletStore.list(),
            this.$.walletStore.listMultiSig()
        ]).then(promiseResult => {
            const singleSigWalletAddresses = promiseResult[0];
            const multiSigWalletAddresses = promiseResult[1];
            return [].concat(
                singleSigWalletAddresses,
                multiSigWalletAddresses,
                this._userFriendlyAddressesToAddresses(this._vestingAccountList.get()),
                this._userFriendlyAddressesToAddresses(this._htlcAccountList.get()),
                this._userFriendlyAddressesToAddresses(this._pendingContractsList.get())
            );
        });
    }

    _updateNanoSubscriptions() {
        if (this.$.clientType !== DevUi.ClientType.NANO) return;
        // avoid frequent subsequent changes to nano subscriptions as these are costly
        clearTimeout(this._updateNanoSubscriptionsTimer);
        this._updateNanoSubscriptionsTimer = setTimeout(
            () => this._getAddresses().then(addresses => this.$.consensus.subscribeAccounts(addresses)),
            1000);
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
