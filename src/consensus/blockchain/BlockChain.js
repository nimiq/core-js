class Blockchain extends Observable {

    static async getPersistent(accounts) {
        const store = BlockchainStore.getPersistent();
        return await new Blockchain(store, accounts);
    }

    static async createVolatile(accounts) {
        const store = BlockchainStore.createVolatile();
        return await new Blockchain(store, accounts);
    }

    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        this._mainChain = null;
        this._mainPath = null;
        this._headHash = null;

        this._synchronizer = new Synchronizer();

        return this._init();
    }

    async _init() {
        // Load the main chain from storage.
        this._mainChain = await this._store.getMainChain();

        // If we don't know any chains, start with the genesis chain.
        if (!this._mainChain) {
            this._mainChain = new Chain(Block.GENESIS);
            await this._store.put(this._mainChain);
        }

        // Cache the hash of the head of the current main chain.
        this._headHash = await this._mainChain.hash();

        // Fetch the path along the main chain.
        this._mainPath = await this._fetchPath(this.head);

        // Automatically commit the chain head if the accountsHash matches.
        // Needed to bootstrap the empty accounts tree.
        if (this.accountsHash.equals(this.head.accountsHash)) {
            await this._accounts.commitBlock(this._mainChain.head);
        } else {
            // Assume that the accounts tree is in the correct state.
            // TODO validate this?
        }

        return this;
    }

    async _fetchPath(block, maxBlocks = 10000) {
        let hash = await block.hash();
        const path = [hash];

        while (maxBlocks-- && !Block.GENESIS.HASH.equals(hash)) {
            const prevChain = await this._store.get(block.prevHash.toBase64());
            if (!prevChain) throw 'Failed to find predecessor block ' + block.prevHash.toBase64();

            path.unshift(block.prevHash);
            block = prevChain.head;
            hash = block.prevHash;
        }

        return path;
    }

    pushBlock(block) {
        return new Promise( (resolve, error) => {
            this._synchronizer.push( _ => {
                return this._pushBlock(block);
            }, resolve, error);
        });
    }

    async _pushBlock(block) {
        // Check if we already know this block. If so, ignore it.
        const hash = await block.hash();
        const knownChain = await this._store.get(hash.toBase64());
        if (knownChain) {
            console.log('Blockchain ignoring known block', block);
            return;
        }

        // Retrieve the previous block. Fail if we don't know it.
        const prevChain = await this._store.get(block.prevHash.toBase64());
        if (!prevChain) {
            console.log('Blockchain discarding block ' + hash.toBase64() + ', previous block ' + block.prevHash.toBase64() + ' unknown', block);
            return;
        }

        // Compute the new total work & height.
        const totalWork = prevChain.totalWork + block.difficulty;
        const height = prevChain.height + 1;

        // Store the new block.
        const newChain = new Chain(block, totalWork, height);
        await this._store.put(newChain);

        // Check if the new block extends our current main chain.
        if (block.prevHash.equals(this._headHash)) {
            // Check if the block matches the account state.
            if (this.accountsHash.equals(block.accountsHash)) {
                // AccountsHash matches, commit the block.
                await this._accounts.commitBlock(block);

                // Update main chain.
                this._mainChain = newChain;
                this._headHash = await newChain.hash();
                this._mainPath.push(this._headHash);

                // Tell listeners that the head of the chain has changed.
                this.fire('head-changed', this.head);
            } else {
                // AccountsHash mismatch.
                // TODO error handling
                console.log('Blockchain rejecting block, AccountsHash mismatch: current=' + this.accountsHash.toBase64() + ', block=' + block.accountsHash, block);
            }
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        else if (newChain.totalWork > this.totalWork) {
            // TODO rebranch blockchain
            throw 'Blockchain rebranching NOT IMPLEMENTED';
        }

        // Otherwise, we are creating/extending a fork.
        else {
            console.log('Forking blockchain', newChain);
        }
    }

    async _rebranch(newHead) {
        console.log('Rebranching BlockChain...');
        throw 'BlockChain.rebranch() not implemented';

        /*
        let oldHead = this._mainChain.head;
        let newBranch = [newHead];
        while (!oldHead.isSuccessorOf(newBranch[0])) {
            await this._p2pDB.accounts.revertBlock(oldHead);
            oldHead = await this._p2pDB.blocks.get(newBranch[0].header.prevHash);
            newBranch.unshift(oldHead);
        }

        for (let block of newBranch) {
            await this._p2pDB.accounts.commitBlock(block);
        }

        this._mainChain = newHead;
        */
    }

    async getBlock(hash) {
        const chain = await this._store.get(hash.toBase64());
        return chain ? chain.head : null;
    }


    get head() {
        return this._mainChain.head;
    }

    get totalWork() {
        return this._mainChain.totalWork;
    }

    get height() {
        return this._mainChain.height;
    }

    get headHash() {
        return this._headHash;
    }

    get accountsHash() {
        return this._accounts.hash;
    }

    get path() {
        return this._mainPath;
    }
}

class Chain {
    constructor(head, totalWork, height = 1) {
        this._head = head;
        this._totalWork = totalWork ? totalWork : head.difficulty;
        this._height = height;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, Chain);
        Block.cast(o._head);
        return o;
    }

    get head() {
        return this._head;
    }

    get totalWork() {
        return this._totalWork;
    }

    get height() {
        return this._height;
    }

    hash() {
        return this._head.hash();
    }
}
