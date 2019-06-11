/** @typedef {function(transactionHash: Hash):void} MempoolListener */
/** @class Client.Mempool */
Client.Mempool = class Mempool {
    /**
     * @param {Client} client
     * @package
     */
    constructor(client) {
        this._client = client;

        /** @type {HashMap.<Handle, MempoolListener>} */
        this._transactionAddedListeners = new HashMap();
        /** @type {HashMap.<Handle, MempoolListener>} */
        this._transactionRemovedListeners = new HashMap();
        /** @type {Handle} */
        this._listenerId = 0;
    }

    /**
     * @param {Transaction} tx
     * @package
     */
    _onTransactionAdded(tx) {
        for (let listener of this._transactionAddedListeners.valueIterator()) {
            listener(tx.hash());
        }
    }

    /**
     * @param {Transaction} tx
     * @package
     */
    _onTransactionRemoved(tx) {
        for (let listener of this._transactionRemovedListeners.valueIterator()) {
            listener(tx.hash());
        }
    }

    /**
     * @returns {Promise.<Hash[]>} The hashes of all transactions in the current mempool.
     */
    async getTransactions() {
        const consensus = await this._client._consensus;
        return consensus.getMempoolContents().map(tx => tx.hash());
    }

    /**
     * Gives some statistics on the current mempool. Well suited to estimate the ideal fee for a transaction
     *
     * @returns {Promise.<Client.MempoolStatistics>} Some statistics on the current mempool.
     */
    async getStatistics() {
        const consensus = await this._client._consensus;
        return new Client.Mempool.Statistics(consensus.getMempoolContents());
    }

    /**
     * @param {MempoolListener} listener
     * @return {Promise<Handle>}
     */
    async addTransactionAddedListener(listener) {
        const listenerId = this._listenerId++;
        this._transactionAddedListeners.put(listenerId, listener);
        return listenerId;
    }

    /**
     * @param {MempoolListener} listener
     * @return {Promise<Handle>}
     */
    async addTransactionRemovedListener(listener) {
        const listenerId = this._listenerId++;
        this._transactionRemovedListeners.put(listenerId, listener);
        return listenerId;
    }

    /**
     * @param {Handle} handle
     */
    removeListener(handle) {
        this._transactionAddedListeners.remove(handle);
        this._transactionRemovedListeners.remove(handle);
    }
};

/** @class Client.MempoolStatistics */
Client.MempoolStatistics = class MempoolStatistics {
    /**
     * @param {Array.<Transaction>} mempoolContents
     */
    constructor(mempoolContents) {
        const buckets = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0];
        this._countPerBucket = {buckets: []};
        this._sizePerBucket = {buckets: []};
        this._totalCount = mempoolContents.length;
        this._totalSize = 0;
        this._requiredFeePerByte = 0;
        // Transactions are ordered by feePerByte
        for (const tx of mempoolContents) {
            // Find appropriate bucked
            let i = 0;
            while (tx.feePerByte < buckets[i]) i++;
            const bucket = buckets[i];
            if (!this._countPerBucket[bucket]) {
                this._countPerBucket[bucket] = 0;
                this._countPerBucket.buckets.push(bucket);
                this._sizePerBucket[bucket] = 0;
                this._sizePerBucket.buckets.push(bucket);
            }
            this._countPerBucket[bucket]++;
            this._sizePerBucket[bucket] += tx.serializedSize;
            this._totalSize += tx.serializedSize;
            if (this._totalSize < Policy.BLOCK_SIZE_MAX) {
                this._requiredFeePerByte = tx.feePerByte;
            }
        }
        if (this._totalSize < Policy.BLOCK_SIZE_MAX) this._requiredFeePerByte = 0;
    }

    /**
     * The number of transactions in the local mempool.
     * @returns {number}
     */
    get count() {
        return this._totalCount;
    }

    /**
     * Total summed size of all transactions in the local mempool.
     * @returns {number}
     */
    get size() {
        return this._totalSize;
    }

    /**
     * The fee per byte required to be included in the next block according to the local mempool.
     * @type {number}
     */
    get requiredFeePerByte() {
        return this._requiredFeePerByte;
    }

    /**
     * The number of transactions sorted into buckets by fee per byte
     * @returns {{buckets: Array}|*}
     */
    get countInBuckets() {
        return this._countPerBucket;
    }

    /**
     * The summed size of transactions sorted into buckets by fee per byte
     * @returns {{buckets: Array}|*}
     */
    get sizeInBuckets() {
        return this._sizePerBucket;
    }
};
