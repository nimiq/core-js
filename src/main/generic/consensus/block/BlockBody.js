class BlockBody {

    /**
     * @param {Address} minerAddr
     * @param {Array.<Transaction>} transactions
     */
    constructor(minerAddr, transactions) {
        if (!(minerAddr instanceof Address)) throw 'Malformed minerAddr';
        if (!transactions || transactions.some(it => !(it instanceof Transaction))) throw 'Malformed transactions';
        /** @type {Address} */
        this._minerAddr = minerAddr;
        /** @type {Array.<Transaction>} */
        this._transactions = transactions;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {BlockBody}
     */
    static unserialize(buf) {
        const minerAddr = Address.unserialize(buf);
        const numTransactions = buf.readUint16();
        const transactions = new Array(numTransactions);
        for (let i = 0; i < numTransactions; i++) {
            transactions[i] = Transaction.unserialize(buf);
        }
        return new BlockBody(minerAddr, transactions);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._minerAddr.serialize(buf);
        buf.writeUint16(this._transactions.length);
        for (let tx of this._transactions) {
            tx.serialize(buf);
        }
        return buf;
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        let size = this._minerAddr.serializedSize
            + /*transactionsLength*/ 2;
        for (let tx of this._transactions) {
            size += tx.serializedSize;
        }
        return size;
    }

    /**
     * @return {Promise.<Hash>}
     */
    hash() {
        return BlockBody._computeRoot([this._minerAddr, ...this._transactions]);
    }

    static _computeRoot(values) {
        // values may contain:
        // - transactions (Transaction)
        // - miner address (Uint8Array)
        const len = values.length;
        if (len == 1) {
            const value = values[0];
            return value.hash ? /*transaction*/ value.hash() : /*miner address*/ Hash.light(value.serialize());
        }

        const mid = Math.round(len / 2);
        const left = values.slice(0, mid);
        const right = values.slice(mid);
        return Promise.all([
            BlockBody._computeRoot(left),
            BlockBody._computeRoot(right)
        ]).then(hashes => Hash.light(BufferUtils.concatTypedArrays(hashes[0].serialize(), hashes[1].serialize())));
    }

    equals(o) {
        return o instanceof BlockBody
            && this._minerAddr.equals(o.minerAddr)
            && this._transactions.every((tx, i) => tx.equals(o.transactions[i]));
    }

    /** @type {Address} */
    get minerAddr() {
        return this._minerAddr;
    }

    /** @type {Array.<Transaction>} */
    get transactions() {
        return this._transactions;
    }

    /** @type {number} */
    get transactionCount() {
        return this._transactions.length;
    }
}
Class.register(BlockBody);
