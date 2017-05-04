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
            await this._store.setMainChain(this._mainChain);
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

        if (Block.GENESIS.HASH.equals(hash)) {
            return new IndexedArray(path);
        }

        do {
            const prevChain = await this._store.get(block.prevHash.toBase64());
            if (!prevChain) throw 'Failed to find predecessor block ' + block.prevHash.toBase64();

            // TODO unshift() is inefficient. We should build the array with push()
            // instead and iterate over it in reverse order.
            path.unshift(block.prevHash);

            // Advance to the predecessor block.
            hash = block.prevHash;
            block = prevChain.head;
        } while (--maxBlocks && !Block.GENESIS.HASH.equals(hash));

        return new IndexedArray(path);
    }

    pushBlock(block) {
        return new Promise( (resolve, error) => {
            this._synchronizer.push( () => {
                return this._pushBlock(block);
            }, resolve, error);
        });
    }

    async _pushBlock(block) {
        // Check if we already know this block. If so, ignore it.
        const hash = await block.hash();
        const knownChain = await this._store.get(hash.toBase64());
        if (knownChain) {
            console.log('Blockchain ignoring known block ' + hash.toBase64());
            return true;
        }

        // Retrieve the previous block. Fail if we don't know it.
        const prevChain = await this._store.get(block.prevHash.toBase64());
        if (!prevChain) {
            console.log('Blockchain discarding block ' + hash.toBase64() + ' - previous block ' + block.prevHash.toBase64() + ' unknown');
            return false;
        }

        // Check all intrinsic block invariants.
        if (!await this._verifyBlock(block)) {
            return false;
        }

        // Check that the block is a valid extension of its previous block.
        if (!await this._isValidExtension(prevChain, block)) {
            return false;
        }

        // Block looks good, compute the new total work & height.
        const totalWork = prevChain.totalWork + block.difficulty;
        const height = prevChain.height + 1;

        // Store the new block.
        const newChain = new Chain(block, totalWork, height);
        await this._store.put(newChain);

        // Check if the new block extends our current main chain.
        if (block.prevHash.equals(this._headHash)) {
            // Append new block to the main chain.
            await this._extend(newChain);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        // TODO Compare timestamp if totalWork is equal.
        if (newChain.totalWork > this.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(newChain);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, we are creating/extending a fork. We have stored the block,
        // the head didn't change, nothing else to do.
        console.log('Creating/extending fork with block ' + hash.toBase64()
            + ', height=' + newChain.height + ', totalWork='
            + newChain.totalWork);

        return true;
    }

    async _verifyBlock(block) {
        // Check that the maximum block size is not exceeded.
        if (block.serializedSize > Policy.BLOCK_SIZE_MAX) {
            console.warn('Blockchain rejected block - max block size exceeded');
            return false;
        }

        // Check that header bodyHash matches the actual bodyHash.
        const bodyHash = await block.body.hash();
        if (!block.header.bodyHash.equals(bodyHash)) {
            console.warn('Blockchain rejecting block - body hash mismatch');
            return false;
        }

        // Check that the headerHash matches the difficulty.
        if (!await block.header.verifyProofOfWork()) {
            console.warn('Blockchain rejected block - PoW verification failed');
            return false;
        }

        // Check that all transaction signatures are valid.
        for (let tx of block.body.transactions) {
            if (!await tx.verifySignature()) {
                console.warn('Blockchain rejected block - invalid transaction signature');
                return false;
            }
        }

        // XXX Check that there is only one transaction per sender per block.
        const pubKeys = {};
        for (let tx of block.body.transactions) {
            if (pubKeys[tx.publicKey]) {
                console.warn('Blockchain rejected block - more than one transaction per sender');
                return false;
            }
            pubKeys[tx.publicKey] = true;
        }

        // Everything checks out.
        return true;
    }

    async _isValidExtension(chain, block) {
        // Check that the difficulty matches.
        const nextDifficulty = await this.getNextDifficulty(chain);
        if (nextDifficulty !== block.difficulty) {
            console.warn('Blockchain rejecting block - difficulty mismatch');
            return false;
        }

        // Check that the timestamp is after (or equal) the previous block's timestamp.
        if (chain.head.timestamp > block.timestamp) {
            console.warn('Blockchain rejecting block - timestamp mismatch');
            return false;
        }

        // Everything checks out.
        return true;
    }

    async _extend(newChain) {
        // Validate that the block matches the current account state.
        // XXX This is also enforced by Accounts.commitBlock()
        if (!this.accountsHash.equals(newChain.head.accountsHash)) {
            // AccountsHash mismatch. This can happen if someone gives us an
            // invalid block. TODO error handling
            console.log('Blockchain rejecting block, AccountsHash mismatch: current='
                + this.accountsHash.toBase64() + ', block=' + newChain.head.accountsHash.toBase64());
            return;
        }

        // AccountsHash matches, commit the block.
        await this._accounts.commitBlock(newChain.head);

        // Update main chain.
        const hash = await newChain.hash();
        this._mainChain = newChain;
        this._mainPath.push(hash);
        this._headHash = hash;
        await this._store.setMainChain(this._mainChain);
    }

    async _revert() {
        // Revert the head block of the main chain.
        await this._accounts.revertBlock(this.head);

        // XXX Sanity check: Assert that the accountsHash now matches the
        // accountsHash of the current head.
        if (!this._accounts.hash.equals(this.head.accountsHash)) {
            throw 'Failed to revert main chain - inconsistent state';
        }

        // Load the predecessor chain.
        const prevHash = this.head.prevHash;
        const prevChain = await this._store.get(prevHash.toBase64());
        if (!prevChain) throw 'Failed to find predecessor block ' + prevHash.toBase64() + ' while reverting';

        // Update main chain.
        this._mainChain = prevChain;
        this._mainPath.pop();
        this._headHash = prevHash;
        await this._store.setMainChain(this._mainChain);
    }

    async _rebranch(newChain) {
        const hash = await newChain.hash();
        console.log('Rebranching to fork ' + hash.toBase64() + ', height='
            + newChain.height + ', totalWork=' + newChain.totalWork, newChain);

        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way. In the worst case, this walks all the way
        // up to the genesis block.
        let forkHead = newChain.head;
        const forkChain = [newChain];
        while (this._mainPath.indexOf(forkHead.prevHash) < 0) {
            const prevChain = await this._store.get(forkHead.prevHash.toBase64());
            if (!prevChain) throw 'Failed to find predecessor block ' + forkHead.prevHash.toBase64() + ' while rebranching';

            forkHead = prevChain.head;
            forkChain.unshift(prevChain);
        }

        // The predecessor of forkHead is the desired common ancestor.
        const commonAncestor = forkHead.prevHash;

        console.log('Found common ancestor ' + commonAncestor.toBase64() + ' ' + forkChain.length + ' blocks up');

        // Revert all blocks on the current main chain until the common ancestor.
        while (!this.headHash.equals(commonAncestor)) {
            await this._revert();
        }

        // We have reverted to the common ancestor state. Apply all blocks on
        // the fork chain until we reach the new head.
        for (let block of forkChain) {
            await this._extend(block);
        }
    }

    async getBlock(hash) {
        const chain = await this._store.get(hash.toBase64());
        return chain ? chain.head : null;
    }

    async getNextDifficulty(chain) {
        chain = chain || this._mainChain;

        // The difficulty is adjusted every DIFFICULTY_ADJUSTMENT_BLOCKS blocks.
        if (chain.height % Policy.DIFFICULTY_ADJUSTMENT_BLOCKS == 0) {
            // Compute the actual time it took to mine the last DIFFICULTY_ADJUSTMENT_BLOCKS blocks.
            const startHeight = Math.max(chain.height - Policy.DIFFICULTY_ADJUSTMENT_BLOCKS - 1, 0);
            const startChain = await this._store.get(this._mainPath[startHeight].toBase64());
            const actualTime = chain.head.timestamp - startChain.head.timestamp;

            // Compute the next difficulty.
            const expectedTime = (chain.height - startHeight) * Policy.BLOCK_TIME;
            let nextDifficulty = chain.head.difficulty;
            if (expectedTime < actualTime) {
                nextDifficulty--;
            } else if (expectedTime > actualTime) {
                nextDifficulty++;
            }
            return Math.max(nextDifficulty, Policy.DIFFICULTY_MIN);
        }

        // If the difficulty is not adjusted at this height, the next difficulty
        // is the current difficulty.
        return chain.head.difficulty;
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
Class.register(Blockchain);

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

    static unserialize(buf) {
        const head = Block.unserialize(buf);
        const totalWork = buf.readUint64();
        const height = buf.readUint32();
        return new Chain(head, totalWork, height);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._head.serialize(buf);
        buf.writeUint64(this._totalWork);
        buf.writeUint32(this._height);
        return buf;
    }

    get serializedSize() {
        return this._head.serializedSize
            + /*totalWork*/ 8
            + /*height*/ 4;
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
Class.register(Chain);
