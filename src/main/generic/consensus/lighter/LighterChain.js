class LighterChain extends LightChain {
    /**
     * @param {JungleDB} jdb
     * @param {PartialAccounts} accounts
     * @param {Time} time
     * @returns {Promise.<LighterChain>}
     */
    static getPersistent(jdb, accounts, time) {
        const store = ChainDataStore.getPersistent(jdb);
        const chain = new LighterChain(store, accounts, time);
        return chain._init();
    }

    /**
     * @param {PartialAccounts} accounts
     * @param {Time} time
     * @returns {Promise.<LighterChain>}
     */
    static createVolatile(accounts, time) {
        const store = ChainDataStore.createVolatile();
        const chain = new LighterChain(store, accounts, time);
        return chain._init();
    }

    /**
     * @param {ChainDataStore} store
     * @param {PartialAccounts} accounts
     * @param {Time} time
     * @returns {LighterChain}
     */
    constructor(store, accounts, time) {
        super(store, accounts, time);
    }


    /** @type {PartialAccounts} */
    get accounts() {
        return this._accounts;
    }

    /**
     * @param {Block} block
     * @param {Array.<AccountsProof>} proofs
     * @returns {Promise.<number>}
     */
    pushBlockWithProofs(block, proofs) {
        return this._synchronizer.push(/*priority*/ 0,
            this._pushBlockWithProofs.bind(this, block, proofs));
    }

    /**
     * @param {Block} block
     * @param {Array.<AccountsProof>} proofs
     * @returns {Promise.<number>}
     * @protected
     */
    async _pushBlockWithProofs(block, proofs) {
        // Check if we already know this block.
        const hash = block.hash();
        const knownBlock = await this._store.getBlock(hash);
        if (knownBlock) {
            this._blockKnownCount++;
            return FullChain.OK_KNOWN;
        }

        // Check that the given block is a full block (includes block body).
        if (!block.isFull()) {
            Log.w(LighterChain, 'Rejecting block - body missing');
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify(this._time))) {
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        // if (!(await this._verifyInterlink(block))) {
        //     Log.w(LighterChain, 'Rejecting block - interlink verification failed');
        //     return FullChain.ERR_INVALID;
        // }

        // Check if the block's immediate predecessor is part of the chain.
        /** @type {ChainData} */
        const prevData = await this._store.getChainData(block.prevHash);
        if (!prevData) {
            Log.w(LighterChain, 'Rejecting block - unknown predecessor');
            this._blockOrphanCount++;
            return FullChain.ERR_ORPHAN;
        }

        // Check that the block is a valid successor of its immediate predecessor.
        const predecessor = prevData.head;
        if (!(await block.isImmediateSuccessorOf(predecessor))) {
            Log.w(LighterChain, 'Rejecting block - not a valid immediate successor');
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        // Check that the difficulty is correct.
        const nextTarget = await this.getNextTarget(predecessor);
        Assert.that(BlockUtils.isValidTarget(nextTarget), 'Failed to compute next target in FullChain');
        if (block.nBits !== BlockUtils.targetToCompact(nextTarget)) {
            Log.w(LighterChain, 'Rejecting block - difficulty mismatch');
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        const hasAddresses = await this.accounts.areAddressesAvailable(block.body.getAddresses());
        if (!hasAddresses) {
            if (!proofs || proofs.length === 0) {
                return LighterChain.ERR_MISSING_ACCOUNTS;
            }
        }
        if (Array.isArray(proofs) && proofs.length > 0) {
            try {
                await this._pushAccountsProofsForNewBlocks([block], proofs);
            } catch (e) {
                Log.w(LighterChain, 'Failed to reconstruct accounts tree', e);
                return LighterChain.ERR_CANNOT_APPLY_PROOF;
            }
        }

        // Block looks good, create ChainData.
        const chainData = await prevData.nextChainData(block);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            if (!(await this._extend(hash, chainData, prevData))) {
                this._blockInvalidCount++;
                return FullChain.ERR_INVALID;
            }
            this._blockExtendedCount++;
            return FullChain.OK_EXTENDED;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (chainData.totalDifficulty.gt(this.totalDifficulty)) {
            // A fork has become the hardest chain, rebranch to it.
            if (!(await this._rebranch(hash, chainData))) {
                this._blockInvalidCount++;
                return FullChain.ERR_INVALID;
            }
            this._blockRebranchedCount++;
            return FullChain.OK_REBRANCHED;
        }

        // Otherwise, we are creating/extending a fork. Store chain data.
        Log.v(LighterChain, `Creating/extending fork with block ${hash}, height=${block.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);
        await this._store.putChainData(hash, chainData);

        this._blockForkedCount++;
        return FullChain.OK_FORKED;
    }

    /**
     * @param {Array.<Block>} blocks
     * @param {Array.<AccountsProof>} proofs
     * @returns {Promise}
     */
    pushAccountsProofsForNewBlocks(blocks, proofs) {
        return this._synchronizer.push(/*priority*/ 1,
            this._pushAccountsProofsForNewBlocks.bind(this, blocks, proofs));
    }

    /**
     * @param {Array.<Block>} blocks
     * @param {Array.<AccountsProof>} proofs
     * @returns {Promise}
     * @protected
     */
    async _pushAccountsProofsForNewBlocks(blocks, proofs) {
        const oldHash = await this.accounts.hash();
        const addresses = PartialAccounts.gatherAllAddressesForBlocks(blocks);
        const revert = [];
        const commit = [];
        let candidate = await this._store.getChainData(blocks[0].prevHash, true);
        if (!candidate) {
            throw new Error(`Predecessor ${blocks[0].prevHash} of ${blocks[0].hash()} not found, can't push proofs`);
        }
        while (!candidate.onMainChain) {
            commit.unshift(candidate);
            candidate = await this._store.getChainData(candidate.prevHash, true);
        }
        while (candidate.mainChainSuccessor) {
            candidate = await this._store.getChainData(candidate.mainChainSuccessor, true);
            revert.unshift(candidate);
        }
        Log.d(LighterChain, `Calculating accounts state for ${addresses.length} accounts from ${blocks.length === 1 ? blocks[0].hash() : (blocks.length + ' blocks')} in block ${this.headHash}`);
        const tempAccounts = await this.accounts.transaction();
        for (const b of revert) {
            await tempAccounts.revertBlock(b, new TransactionCache());
        }
        for (const b of commit) {
            await tempAccounts.commitBlock(b, new TransactionCache());
        }
        await tempAccounts.pushRevertedProofs(proofs, blocks);
        for (const b of commit.reverse()) {
            await tempAccounts.revertBlock(b, new TransactionCache());
        }
        for (const b of revert.reverse()) {
            await tempAccounts.commitBlock(b, new TransactionCache());
        }
        const hash = await this.accounts.hash();
        const newHash = await tempAccounts.hash();
        if (!oldHash.equals(newHash) || !hash.equals(newHash)) {
            throw new Error(`Adding new proofs changed accounts hash ${oldHash} / ${hash} / ${newHash}`);
        }
        const newProof = await tempAccounts.getAccountsProof(addresses);
        await tempAccounts.abort();
        if (!newProof.verify()) {
            throw new Error('Reverted proof was invalid');
        }
        return this.accounts.pushProof(newProof);
    }

    /**
     * @param {Hash} blockHash
     * @param {AccountsProof} proof
     * @param {Array.<Address>} addresses
     * @returns {Promise}
     */
    pushAccountsProof(blockHash, proof, addresses) {
        return this._synchronizer.push(/*priority*/ 1,
            this._pushAccountsProof.bind(this, blockHash, proof, addresses));
    }

    /**
     * @param {Hash} blockHash
     * @param {AccountsProof} proof
     * @param {Array.<Address>} addresses
     */
    async _pushAccountsProof(blockHash, proof, addresses) {
        if (blockHash.equals(this.headHash)) {
            return this.accounts.pushProof(proof);
        } else {
            if (!addresses) {
                throw new Error('Can\'t push unrelated proof without knowing its supposed addresses');
            }
            const revert = [];
            const commit = [];
            let candidate = await this._store.getChainData(blockHash, true);
            if (!candidate) {
                throw new Error(`Block ${blockHash} not found, can't push proof`);
            }
            while (!candidate.onMainChain) {
                commit.unshift(candidate);
                candidate = await this._store.getChainData(candidate.prevHash, true);
            }
            while (candidate.mainChainSuccessor) {
                candidate = await this._store.getChainData(candidate.mainChainSuccessor, true);
                revert.unshift(candidate);
            }
            const tempAccounts = await this.accounts.transaction();
            for (const b of revert) {
                await tempAccounts.revertBlock(b, new TransactionCache());
            }
            for (const b of commit) {
                await tempAccounts.commitBlock(b, new TransactionCache());
            }
            await tempAccounts.pushProof(proof);
            for (const b of commit.reverse()) {
                await tempAccounts.revertBlock(b, new TransactionCache());
            }
            for (const b of revert.reverse()) {
                await tempAccounts.commitBlock(b, new TransactionCache());
            }
            const newProof = await tempAccounts.getAccountsProof(addresses);
            await tempAccounts.abort();
            return this.accounts.pushProof(newProof);
        }
    }
}

LighterChain.ERR_MISSING_ACCOUNTS = -100;
LighterChain.ERR_CANNOT_APPLY_PROOF = -101;

Class.register(LighterChain);
