class TransactionStoreEntry {
    /**
     * @param {Hash} transactionHash
     * @param {Address} sender
     * @param {Address} recipient
     * @param {number} blockHeight
     * @param {Hash} blockHash
     * @param {number} index
     */
    constructor(transactionHash, sender, recipient, blockHeight, blockHash, index) {
        this._transactionHash = transactionHash;
        this._sender = sender;
        this._recipient = recipient;
        this._blockHeight = blockHeight;
        this._blockHash = blockHash;
        this._index = index;
        this.senderBuffer = this._sender.serialize();
        this.recipientBuffer = this._recipient.serialize();
    }

    /**
     * @param {Block} block
     * @returns {Array.<TransactionStoreEntry>}
     */
    static fromBlock(block) {
        const blockHash = block.hash();
        /** @type {Array.<TransactionStoreEntry>} */
        const entries = [];
        for (let i = 0; i < block.transactions.length; ++i) {
            const transaction = block.transactions[i];
            entries.push(new TransactionStoreEntry(transaction.hash(), transaction.sender, transaction.recipient, block.height, blockHash, i));
        }
        return entries;
    }

    /**
     * @param {string} transactionKey
     * @param {{senderBuffer: Uint8Array, recipientBuffer: Uint8Array, blockHeight: number, blockHash: string, index: number}} o
     * @returns {TransactionStoreEntry}
     */
    static fromJSON(transactionKey, o) {
        return new TransactionStoreEntry(
            Hash.fromBase64(transactionKey),
            Address.unserialize(new SerialBuffer(o.senderBuffer)),
            Address.unserialize(new SerialBuffer(o.recipientBuffer)),
            o.blockHeight,
            Hash.fromBase64(o.blockHash),
            o.index
        );
    }

    /**
     * @returns {{sender: Uint8Array, recipient: Uint8Array, blockHeight: number, blockHash: string, index: number}}
     */
    toJSON() {
        return {
            senderBuffer: this.senderBuffer,
            recipientBuffer: this.recipientBuffer,
            blockHeight: this.blockHeight,
            blockHash: this.blockHash.toBase64(),
            index: this.index
        };
    }

    /** @type {Hash} */
    get transactionHash() {
        return this._transactionHash;
    }

    /** @type {Address} */
    get sender() {
        return this._sender;
    }

    /** @type {Address} */
    get recipient() {
        return this._recipient;
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
        return this.transactionHash.toBase64();
    }
}
Class.register(TransactionStoreEntry);
