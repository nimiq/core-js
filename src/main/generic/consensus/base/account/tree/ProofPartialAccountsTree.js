class ProofPartialAccountsTree extends AccountsTree {
    /**
     * @returns {Promise.<ProofPartialAccountsTree>}
     */
    static async getPersistent(jdb) {
        const store = AccountsTreeStore.getPersistent(jdb);
        const tree = new ProofPartialAccountsTree(store);
        return tree._init();
    }

    /**
     * @returns {Promise.<ProofPartialAccountsTree>}
     */
    static async createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        const tree = new ProofPartialAccountsTree(store);
        return tree._init();
    }

    /**
     * @private
     * @param {AccountsTreeStore} store
     */
    constructor(store) {
        super(store);
    }


    /**
     * Adds a proof at the current state to this partial accounts storage.
     * @param {AccountsProof} proof
     * @param {boolean} truncate
     * @returns {Promise}
     */
    async pushProof(proof, truncate = false) {
        return this._synchronizer.push(() => {
            return this._pushProof(proof, truncate);
        });
    }

    /**
     * @param {AccountsProof} proof
     * @param {boolean} truncate
     */
    async _pushProof(proof, truncate = false) {
        const rootHash = await this.root();
        if (!truncate && !rootHash.equals(proof.root())) {
            throw new Error(`Proof does not match current accounts tree ${rootHash} != ${proof.root()}`);
        }
        if (!proof.verify()) {
            throw new Error('Invalid proof');
        }

        if (truncate) {
            await this._store.truncate();
        }
        const tx = await this.synchronousTransaction();
        try {
            for (let node of proof.nodes) {
                tx._syncStore.putSync(node);
            }
            await tx.commit();
        } catch (e) {
            await tx.abort();
            throw e;
        }

        this._rootHash = await this.root();
    }

    /**
     * @param {AccountsTree} tree
     * @returns {Promise}
     */
    async merge(tree) {
        return this._synchronizer.push(() => {
            return this._merge(tree);
        });
    }

    /**
     * @param {AccountsTree} tree
     */
    async _merge(tree) {
        if (this._rootHash && !(await tree.root()).equals(this._rootHash)) {
            throw new Error('AccountsHash mismatch');
        }
        const tx = await this.synchronousTransaction();
        try {
            for (const node of await tree.getAllNodes()) {
                tx._syncStore.putSync(node);
            }
            await tx.commit();
        } catch (e) {
            await tx.abort();
            throw e;
        }
        this._rootHash = await this.root();
    }

    /**
     * @param {Address} address
     * @returns {{included: boolean, proven: boolean, account: Account}}
     */
    async getProofState(address) {
        const addressHex = address.toHex();
        let node = await this._store.get('');
        while (node) {
            if (node.prefix === addressHex) {
                return {included: true, proven: true, account: node.account};
            }
            const child = node.getChild(addressHex);
            if (child && addressHex.startsWith(child)) {
                node = await this._store.get(child);
            } else {
                return {included: false, proven: true, account: Account.INITIAL};
            }
        }

        // No proof found
        return {included: undefined, proven: false, account: undefined};
    }

    /**
     * @param {string} prefix
     * @returns {Promise.<AccountsTreeNode>}
     * @private
     */
    async _findParent(prefix) {
        const node = await this._store.get(prefix);
        if (node) return node;
        if (prefix === '') return null;
        return this._findParent(prefix.substr(0, prefix.length - 1));
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {ProofPartialAccountsTree}
     */
    transaction(enableWatchdog = true) {
        return new ProofPartialAccountsTree(this._store.transaction(enableWatchdog));
    }
}

Class.register(ProofPartialAccountsTree);

