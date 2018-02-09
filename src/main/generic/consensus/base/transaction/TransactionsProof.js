class TransactionsProof {
    /**
     * @param {Array.<Transaction>} transactions
     * @param {MerkleProof} proof
     */
    constructor(transactions, proof) {
        if (!transactions || !NumberUtils.isUint16(transactions.length)
            || transactions.some(it => !(it instanceof Transaction))) throw new Error('Malformed transactions');
        if (!(proof instanceof MerkleProof)) throw new Error('Malformed merkle proof');

        /** @type {Array.<Transaction>} */
        this._transactions = transactions;
        /** @type {MerkleProof} */
        this._proof = proof;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TransactionsProof}
     */
    static unserialize(buf) {
        const count = buf.readUint16();
        const transactions = [];
        for (let i = 0; i < count; ++i) {
            transactions.push(Transaction.unserialize(buf));
        }
        const proof = MerkleProof.unserialize(buf);
        return new TransactionsProof(transactions, proof);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._transactions.length);
        for (const transaction of this._transactions) {
            transaction.serialize(buf);
        }
        this._proof.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*count*/ 2
            + this._transactions.reduce((sum, transaction) => sum + transaction.serializedSize, 0)
            + this._proof.serializedSize;
    }

    /**
     * @returns {string}
     */
    toString() {
        return `TransactionsProof{length=${this.length}}`;
    }

    /**
     * @returns {Hash}
     */
    root() {
        return this._proof.computeRoot(this._transactions);
    }

    /** @type {number} */
    get length() {
        return this._transactions.length;
    }

    /** @type {Array.<Transaction>} */
    get transactions() {
        return this._transactions;
    }

    /** @type {MerkleProof} */
    get proof() {
        return this._proof;
    }
}
Class.register(TransactionsProof);
