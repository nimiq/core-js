class TransactionsStoreEntry {
    /**
     * @param {Hash} txid
     * @param {Address} sender
     * @param {Address} recipient
     * @param {number} blockHeight
     * @param {Hash} blockHash
     * @param {number} index
     */
    constructor(txid, sender, recipient, blockHeight, blockHash, index) {
        this._txid = txid;
        this._senderAddress = sender;
        this._recipientAddress = recipient;
        this._blockHeight = blockHeight;
        this._blockHash = blockHash;
        this._index = index;
        this.sender = sender.toBase64();
        this.recipient = recipient.toBase64();
    }

    /**
     * @param {Block} block
     * @returns {Promise.<Array.<TransactionsStoreEntry>>}
     */
    static async fromBlock(block) {
        const blockHash = await block.hash();
        /** @type {Array.<Promise.<TransactionsStoreEntry>>} */
        const entryPromises = [];
        for (let i=0; i<block.transactions.length; ++i) {
            const transaction = block.transactions[i];
            const entryPromise = transaction.hash().then(txid =>
                new TransactionsStoreEntry(txid, transaction.sender, transaction.recipient, block.height, blockHash, i)
            );
            entryPromises.push(entryPromise);
        }
        return Promise.all(entryPromises);
    }

    /**
     * @param {string} txid
     * @param {{txid: string, sender: string, recipient: string, blockHeight: number, blockHash: string, index: number}} o
     * @returns {TransactionsStoreEntry}
     */
    static fromJSON(txid, o) {
        return new TransactionsStoreEntry(
            Hash.fromBase64(txid),
            Address.fromBase64(o.sender),
            Address.fromBase64(o.recipient),
            o.blockHeight,
            Hash.fromBase64(o.blockHash),
            o.index
        );
    }

    /**
     * @returns {{txid: string, senderAddress: string, recipientAddress: string, blockHeight: number, blockHash: string, index: number}}
     */
    toJSON() {
        return {
            sender: this.sender,
            recipient: this.recipient,
            blockHeight: this.blockHeight,
            blockHash: this.blockHash.toBase64(),
            index: this.index
        };
    }

    /** @type {Hash} */
    get txid() {
        return this._txid;
    }

    /** @type {Address} */
    get senderAddress() {
        return this._senderAddress;
    }

    /** @type {Address} */
    get recipientAddress() {
        return this._recipientAddress;
    }

    /** @type {number} */
    get blockHeight() {
        return this._blockHeight;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {number} */
    get index() {
        return this._index;
    }

    /** @type {string} */
    get key() {
        return this.txid.toBase64();
    }
}
Class.register(TransactionsStoreEntry);
