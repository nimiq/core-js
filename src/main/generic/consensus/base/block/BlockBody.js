class BlockBody {
    /**
     * @param {BlockBody} o
     * @returns {BlockBody}
     */
    static copy(o) {
        if (!o) return o;
        const minerAddr = Address.copy(o._minerAddr);
        const transactions = o._transactions.map(it => Transaction.copy(it));
        return new BlockBody(minerAddr, transactions, o.extraData);
    }

    /**
     * @param {Uint8Array} extraData
     * @returns {number}
     */
    static getMetadataSize(extraData) {
        return Address.SERIALIZED_SIZE
            + SerialBuffer.varUintSize(extraData.byteLength)
            + extraData.byteLength
            + /*transactionsLength*/ 2;
    }

    /**
     * @param {Address} minerAddr
     * @param {Array.<Transaction>} transactions
     * @param {Uint8Array} [extraData]
     */
    constructor(minerAddr, transactions, extraData = new Uint8Array(0)) {
        if (!(minerAddr instanceof Address)) throw 'Malformed minerAddr';
        if (!transactions || transactions.some(it => !(it instanceof Transaction))) throw 'Malformed transactions';
        /** @type {Address} */
        this._minerAddr = minerAddr;
        /** @type {Array.<Transaction>} */
        this._transactions = transactions;
        /** @type {Uint8Array} */
        this._extraData = extraData;
        /** @type {Hash} */
        this._hash = null;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {BlockBody}
     */
    static unserialize(buf) {
        const minerAddr = Address.unserialize(buf);
        const extraDataLength = buf.readVarUint();
        const extraData = buf.read(extraDataLength);
        const numTransactions = buf.readUint16();
        const transactions = new Array(numTransactions);
        for (let i = 0; i < numTransactions; i++) {
            transactions[i] = Transaction.unserialize(buf);
        }
        return new BlockBody(minerAddr, transactions, extraData);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._minerAddr.serialize(buf);
        buf.writeVarUint(this._extraData.byteLength);
        buf.write(this._extraData);
        buf.writeUint16(this._transactions.length);
        for (const tx of this._transactions) {
            tx.serialize(buf);
        }
        return buf;
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        let size = this._minerAddr.serializedSize
            + SerialBuffer.varUintSize(this._extraData.byteLength)
            + this._extraData.byteLength
            + /*transactionsLength*/ 2;
        for (const tx of this._transactions) {
            size += tx.serializedSize;
        }
        return size;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        /** @type {Transaction} */
        let previousTx = null;
        for (const tx of this._transactions) {
            // Ensure transactions are ordered.
            if (previousTx && previousTx.compareBlockOrder(tx) > 0) {
                Log.w(BlockBody, 'Invalid block - transactions not ordered.');
                return false;
            }
            previousTx = tx;

            // Check that all transactions are valid.
            if (!(await tx.verify())) { // eslint-disable-line no-await-in-loop
                Log.w(BlockBody, 'Invalid block - invalid transaction');
                return false;
            }
        }

        // Everything checks out.
        return true;
    }

    /**
     * @return {Promise.<Hash>}
     */
    async hash() {
        if (!this._hash) {
            const fnHash = value => value.hash ?
                /*transaction*/ value.hash() : /*miner address*/ Hash.light(value.serialize());
            this._hash = await MerkleTree.computeRoot([this._minerAddr, {serialize: () => this._extraData}, ...this._transactions], fnHash);
        }
        return this._hash;
    }

    equals(o) {
        return o instanceof BlockBody
            && this._minerAddr.equals(o.minerAddr)
            && this._transactions.every((tx, i) => tx.equals(o.transactions[i]));
    }

    /** @type {Uint8Array} */
    get extraData() {
        return this._extraData;
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
