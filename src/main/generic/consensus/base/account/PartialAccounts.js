class PartialAccounts extends Accounts {
    /**
     * Generate an Accounts object that is persisted to the local storage.
     * @returns {Promise.<PartialAccounts>} Accounts object
     */
    static async getPersistent(jdb) {
        const tree = await ProofPartialAccountsTree.getPersistent(jdb);
        return new PartialAccounts(tree);
    }

    /**
     * Generate an PartialAccounts object that loses it's data after usage.
     * @returns {Promise.<PartialAccounts>} Accounts object
     */
    static async createVolatile() {
        const tree = await ProofPartialAccountsTree.createVolatile();
        return new PartialAccounts(tree);
    }

    /**
     * @param {ProofPartialAccountsTree} tree
     */
    constructor(tree) {
        super(tree);
        /** @type {ProofPartialAccountsTree} */
        this._tree = tree;
    }

    /**
     * @param {string} startPrefix
     * @returns {Promise.<?AccountsTreeChunk>}
     */
    getAccountsTreeChunk(startPrefix) {
        return null;
    }

    /**
     * @param {Array.<Block>} blocks
     * @returns {Array.<Address>}
     */
    static gatherAllAddressesForBlocks(blocks) {
        const set = new HashSet();
        for (let block of blocks) {
            set.addAll(block.body.getAddresses());
        }
        return set.values();
    }

    /**
     * @param {Array.<AccountsProof>} proofs
     * @param {Array.<Block>} blocks
     */
    async pushRevertedProofs(proofs, blocks) {
        const accounts = await PartialAccounts.createVolatile();
        let first = true;
        for (let proof of proofs) {
            await accounts.pushProof(proof, first);
            first = false;
        }

        // Revert from remote state
        for (const block of blocks.reverse()) {
            await accounts.revertBlock(block, new TransactionCache());
        }

        if ((await accounts.hash()).equals(await this.hash())) {
            // Merge reverted accounts tree in local state.
            await this._tree.merge(accounts._tree);
        } else {
            throw new Error('Could not merge reverted proof, accounts hash mismatch');
        }
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise.<boolean>}
     */
    async areAddressesAvailable(addresses) {
        for (let address of addresses) {
            const proofState = await this._tree.getProofState(address);
            if (!proofState.proven) return false;
        }
        return true;
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise<Array.<Address>>}
     */
    async missingAddreses(addresses) {
        const missing = new HashSet();
        for (let address of addresses) {
            const proofState = await this._tree.getProofState(address);
            if (!proofState.proven) missing.add(address);
        }
        return missing.values();
    }

    /**
     * @param {AccountsProof} proof
     * @param {boolean} truncate
     * @returns {Promise}
     */
    async pushProof(proof, truncate = false) {
        return this._tree.pushProof(proof, truncate);
    }


    /**
     * @param {boolean} [enableWatchdog]
     * @returns {Promise.<Accounts>}
     */
    async transaction(enableWatchdog = true) {
        return new PartialAccounts(await this._tree.transaction(enableWatchdog));
    }

    //
    // /**
    //  * Try to change the account state according to the details presented in the block.
    //  * @param {Block} block
    //  * @param {Array.<AccountsProof>} proofs List of account proofs after
    //  */
    // pushBlock(block, proofs) {
    //     // Step 1: Check that all provided data is actually valid
    //     if (!block.body.verify()) return {status: -4};
    //     for (let proof of proofs) {
    //         if (!proof.verify()) return {status: -3};
    //     }
    //
    //     // Step 2: Accumulate block balance changes
    //     /** @type {HashMap.<Address, number>} */
    //     const balanceMap = new HashMap();
    //     // Assign fee and block reward to the block creator
    //     balanceMap.put(block.minerAddr, block.body.transactions.reduce((sum, tx) => sum + tx.fee, Policy.blockRewardAt(block.height)));
    //     for (let tx of block.body.transactions) {
    //         if (!balanceMap.contains(tx.sender)) balanceMap.put(tx.sender, 0);
    //         if (!balanceMap.contains(tx.recipient)) balanceMap.put(tx.recipient, 0);
    //         balanceMap.put(tx.sender, balanceMap.get(tx.sender) - tx.value);
    //         balanceMap.put(tx.recipient, balanceMap.get(tx.recipient) + tx.value);
    //     }
    //
    //     // Step 3: Check that the set of proofs is sufficient to proof block validity
    //     /** @type {HashMap.<Address, AccountsTreeNode>} */
    //     const nodeMap = new HashMap();
    //     for (let node of proofs.flatMap(proof => proof.nodes)) {
    //         nodeMap.put(Address.fromHex(node.prefix), node);
    //     }
    //     /** @type {HashSet.<Address>} */
    //     const missingProofs = new HashSet();
    //     /**
    //      * List of addresses that might require a sibling proof to verify the block. Siblings lacking inclusion proof.
    //      * @type {HashSet.<Address>}
    //      */
    //     const siblingNoProof = new HashSet();
    //     /**
    //      * List of addresses that might require a sibling proof to verify the block. Siblings with inclusion proof.
    //      * @type {HashSet.<Address>}
    //      */
    //     const siblingWithProof = new HashSet();
    //     for (let address of balanceMap.keys()) {
    //         const proofState = this._getProofState(address);
    //         if (!proofState.node) {
    //             // No proof present
    //             // We need inclusion proof and maybe sibling (in case of account deletion)
    //             if (!nodeMap.contains(address)) {
    //                 missingProofs.add(address);
    //             } else {
    //                 const newBalance = nodeMap.get(address).account.balance;
    //                 if (balanceMap.get(address) === newBalance) {
    //                     // Account just created
    //                     siblingNoProof.add(address);
    //                 } else if (balanceMap.get(address) > newBalance) {
    //                     // For this to be true, the balance would be negative before
    //                     return {status: -2};
    //                 } else {
    //                     // Already have required proofs on hand
    //                 }
    //             }
    //         } else if (!proofState.included) {
    //             // Exclusion proof present
    //             if (balanceMap.get(address) < 0) {
    //                 // Cannot transfer funds from empty account, so obviously invalid.
    //                 return {status: -2};
    //             } else {
    //                 // we can construct inclusion proof from here.
    //             }
    //         } else {
    //             // Inclusion proof present
    //             if (-balanceMap.get(address) > proofState.account.balance) {
    //                 // Cannot transfer more than available
    //                 return false; // TODO return value
    //             } else if (-balanceMap.get(address) === proofState.account.balance) {
    //                 // might need sibling (account deletion)
    //                 siblingWithProof.add(address);
    //             } else {
    //                 // we can construct inclusion proof from here
    //             }
    //         }
    //     }
    //
    //     // Step 4: Check if we need additional proofs to verify account deletion
    //     if (siblingNoProof.length > 0 || siblingWithProof.length > 0) {
    //         throw 'not yet implemented';
    //     }
    //
    //     // Step 5: Suggest further proofs if necessary
    //     if (missingProofs.length > 0) {
    //         return {status: -1, missingProofs};
    //     }
    // }


    //
    // /**
    //  * @param {Array.<Address>} addresses
    //  * @returns {HashSet.<Address>}
    //  */
    // missingProofs(...addresses) {
    //     /** @type {HashSet.<Address>} */
    //     const leaves = new HashSet();
    //     for (let address of addresses) {
    //         if (!this._store.getSync(address.toHex(), false)) {
    //             const parent = this._findParent(address.toHex().substr(0, 39));
    //             if (!parent || parent.getChild(address.toHex())) {
    //                 leaves.add(address);
    //             }
    //
    //         }
    //     }
    //     return leaves;
    // }
    //
    // /**
    //  * @param {Array.<Block>} blocks
    //  * @returns {HashSet.<Address>}
    //  */
    // missingProofsForBlocks(...blocks) {
    //     /** @type {HashSet.<Address>} */
    //     const leaves = new HashSet();
    //     leaves.addAll(this.missingProofs(blocks.map(b => b.minerAddr)));
    //     for (let block of blocks) {
    //         leaves.addAll(this.missingProofsForTransactions(block.transactions));
    //     }
    //     return leaves;
    // }
    //
    // /**
    //  * @param {Array.<Transaction>} transactions
    //  * @returns {HashSet.<Address>}
    //  */
    // missingProofsForTransactions(...transactions) {
    //     const leaves = this.missingProofs([
    //         ...transactions.map(tx => tx.recipient),
    //         ...transactions.map(tx => tx.sender)
    //     ]);
    //     /** @type {HashMap.<Address, number>} */
    //     const balanceMap = new HashMap();
    //     for (let tx of transactions) {
    //         if (balanceMap.contains(tx.sender)) {
    //             balanceMap.put(tx.sender, balanceMap.get(tx.sender) + tx.value + tx.fee);
    //         } else {
    //             balanceMap.put(tx.sender, tx.value + tx.fee);
    //         }
    //     }
    //     for (let addr of balanceMap.keyIterator()) {
    //         const acc = this._store.getSync(addr, false);
    //         if (acc && acc.account.balance <= balanceMap.get(addr)) {
    //             const parent = this._findParent(address.toHex().substr(0, 39));
    //             const sibblings = parent.getChildren().filter(a => !address.toHex().startsWith(a));
    //             if (sibblings.length === 1) {
    //                 if (!this._store.getSync(sibblings[0], false)) {
    //                     leaves.add(Address.fromHex(sibblings[0] + ((40 - sibblings[0].length) * '0')));
    //                 }
    //             }
    //         }
    //     }
    // }
    //
    // /**
    //  * @param {Array.<Address>} addresses
    //  * @returns {HashSet.<Address>}
    //  */
    // _missingProofsForAccountDeletion(...addresses) {
    //    
    // }
}
