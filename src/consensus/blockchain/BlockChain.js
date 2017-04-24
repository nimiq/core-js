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

        return this._init();
    }

    async _init() {
        // Load the hardest chain we know.
        this._hardestChain = await this._store.getHardestChain();

        // If we don't know any chains, start with the genesis chain.
        if (!this._hardestChain) {
            this._hardestChain = new Chain(Block.GENESIS);
            await this._store.put(this._hardestChain);
        }

        // Automatically commit the chain head if the accountsHash matches.
        if (this.accountsHash.equals(this.head.header.accountsHash)) {
            await this._accounts.commitBlock(this._hardestChain.head);
        } else {
            // Assume that the accounts tree is in the correct state.
            // TODO validate this?
        }
        return this;
    }

    async pushBlock(block) {
        // Check if we already know this block. If so, ignore it.
        const hash = await block.hash();
        const knownChain = await this._store.get(hash.toBase64());
        if (knownChain) {
            console.log('Blockchain ignoring known block', block);
            return;
        }

        // Retrieve the previous block. Fail if we don't know it.
        const prevChain = await this._store.get(block.header.prevHash.toBase64());
        if (!prevChain) {
            console.log('Blockchain discarding block, previous block unknown', block);
            return;
        }

        // Compute the new total work & height.
        const totalWork = prevChain.totalWork + block.header.difficulty;
        const height = prevChain.height + 1;

        // Store the new block.
        const newChain = new Chain(block, totalWork, height);
        await this._store.put(newChain);

        // Check if the new block extends our current hardest chain.
        if (block.isSuccessorOf(this.head)) {
            // Check if the block matches the account state.
            if (this.accountsHash.equals(block.header.accountsHash)) {
                // AccountsHash matches, commit the block.
                await this._accounts.commitBlock(block);

                // Update hardest chain.
                this._hardestChain = newChain;

                // Tell listeners that the head of the chain has changed.
                this.fire('head-changed', this.head);
            } else {
                // AccountsHash mismatch.
                // TODO error handling
                console.log('Blockchain rejecting block, AccountsHash mismatch: current=' + this.accountsHash.toBase64() + ', block=' + block.header.accountsHash, block);
            }
        }

        // Otherwise, check if the new chain is harder than our current one.
        else if (newChain.totalWork > this.totalWork) {
            // TODO rebranch blockchain
            throw 'Blockchain rebranching NOT IMPLEMENTED';
        }
    }

    async _rebranch(newHead) {
        console.log('Rebranching BlockChain...');
        throw 'BlockChain.rebranch() not implemented';

        /*
        let oldHead = this._hardestChain.head;
        let newBranch = [newHead];
        while (!oldHead.isSuccessorOf(newBranch[0])) {
            await this._p2pDB.accounts.revertBlock(oldHead);
            oldHead = await this._p2pDB.blocks.get(newBranch[0].header.prevHash);
            newBranch.unshift(oldHead);
        }

        for (let block of newBranch) {
            await this._p2pDB.accounts.commitBlock(block);
        }

        this._hardestChain = newHead;
        */
    }

    async getBlock(hash) {
        const chain = await this._store.get(hash.toBase64());
        return chain ? chain.head : null;
    }

    get head() {
        return this._hardestChain.head;
    }

    get totalWork() {
        return this._hardestChain.totalWork;
    }

    get height() {
        return this._hardestChain.height;
    }

    get accountsHash() {
        return this._accounts.hash;
    }
}

class Chain {
    constructor(head, totalWork, height = 1) {
        this._head = head;
        this._totalWork = totalWork ? totalWork : head.header.difficulty;
        this._height = height;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, Chain);
        Block.cast(o._head);
        return o;
    }

    push(block) {
        if (block.isSuccessorOf(this._head)) {
            this._head = block;
            this._totalWork += block.header.difficulty;
            this._height += 1;
        }
        return this._totalWork;
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
