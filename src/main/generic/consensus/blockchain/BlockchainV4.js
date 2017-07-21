class BlockchainV4 extends Observable {
    static getPersistent(accounts) {
        const store = BlockchainStore.getPersistent();
        return new Blockchain(store, accounts);
    }

    static createVolatile(accounts) {
        const store = BlockchainStore.createVolatile();
        return new Blockchain(store, accounts);
    }

    /**
     * @param {BlockStore} store
     * @param {Accounts} accounts
     * @return {Promise}
     * @private
     */
    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        this._sparse = new SparseChain();
        this._dense = new DenseChain();
        this._full = new FullChain();

        // Blocks arriving fast over the network will create a backlog of blocks
        // in the synchronizer queue. Tell listeners when the blockchain is
        // ready to accept blocks again.
        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init();
    }

    async _init() {

        return this;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     */
    push(block) {
        return this._synchronizer.push(() => {
            return this._push(block);
        });
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _push(block) {
        // Check if already known?

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            return false;
        }

        // Add to sparse chain
        // Add to dense chain
        // Add to full chain
    }
}
