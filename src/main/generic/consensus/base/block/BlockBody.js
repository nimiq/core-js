class BlockBody {
    /**
     * @param {Uint8Array} extraData
     * @returns {number}
     */
    static getMetadataSize(extraData) {
        return Address.SERIALIZED_SIZE
            + /*extraDataLength*/ 1
            + extraData.byteLength
            + /*transactionsLength*/ 2;
    }

    /**
     * @param {Address} minerAddr
     * @param {Array.<Transaction>} transactions
     * @param {Uint8Array} [extraData]
     * @param {Array.<PrunedAccount>} prunedAccounts
     */
    constructor(minerAddr, transactions, extraData = new Uint8Array(0), prunedAccounts = []) {
        if (!(minerAddr instanceof Address)) throw 'Malformed minerAddr';
        if (!Array.isArray(transactions) || transactions.some(it => !(it instanceof Transaction))) throw 'Malformed transactions';
        if (!(extraData instanceof Uint8Array) || !NumberUtils.isUint8(extraData.byteLength)) throw 'Malformed extraData';

        /** @type {Address} */
        this._minerAddr = minerAddr;
        /** @type {Uint8Array} */
        this._extraData = extraData;
        /** @type {Array.<Transaction>} */
        this._transactions = transactions;
        /** @type {Array.<PrunedAccount>} */
        this._prunedAccounts = prunedAccounts;
        /** @type {Hash} */
        this._hash = null;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {BlockBody}
     */
    static unserialize(buf) {
        const minerAddr = Address.unserialize(buf);
        const extraDataLength = buf.readUint8();
        const extraData = buf.read(extraDataLength);
        const numTransactions = buf.readUint16();
        const transactions = new Array(numTransactions);
        for (let i = 0; i < numTransactions; i++) {
            transactions[i] = Transaction.unserialize(buf);
        }
        const numPrunedAccounts = buf.readUint16();
        const prunedAccounts = [];
        for (let i = 0; i < numPrunedAccounts; i++) {
            prunedAccounts.push(PrunedAccount.unserialize(buf));
        }
        return new BlockBody(minerAddr, transactions, extraData, prunedAccounts);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._minerAddr.serialize(buf);
        buf.writeUint8(this._extraData.byteLength);
        buf.write(this._extraData);
        buf.writeUint16(this._transactions.length);
        for (const tx of this._transactions) {
            tx.serialize(buf);
        }
        buf.writeUint16(this._prunedAccounts.length);
        for (const acc of this._prunedAccounts) {
            acc.serialize(buf);
        }
        return buf;
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        let size = this._minerAddr.serializedSize
            + /*extraDataLength*/ 1
            + this._extraData.byteLength
            + /*transactionsLength*/ 2
            + /*prunedAccountsLength*/ 2;
        for (const tx of this._transactions) {
            size += tx.serializedSize;
        }
        size += this._prunedAccounts.reduce((sum, acc) => sum + acc.serializedSize, 0);
        return size;
    }

    /**
     * @returns {boolean}
     */
    verify() {
        /** @type {Transaction} */
        let previousTx = null;
        for (const tx of this._transactions) {
            // Ensure transactions are ordered and unique.
            if (previousTx && previousTx.compareBlockOrder(tx) >= 0) {
                Log.w(BlockBody, 'Invalid block - transactions not ordered.');
                return false;
            }
            previousTx = tx;

            // Check that all transactions are valid.
            if (!tx.verify()) {
                Log.w(BlockBody, 'Invalid block - invalid transaction');
                return false;
            }
        }

        let previousAcc = null;
        for (const acc of this._prunedAccounts) {
            // Ensure pruned accounts are ordered and unique.
            if (previousAcc && previousAcc.compare(acc) >= 0) {
                Log.w(BlockBody, 'Invalid block - pruned accounts not ordered.');
                return false;
            }
            previousAcc = acc;
            
            // Check that pruned accounts are actually supposed to be pruned
            if (!acc.account.isToBePruned()) {
                Log.w(BlockBody, 'Invalid block - invalid pruned account');
                return false;
            }
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {Array}
     */
    getMerkleLeafs() {
        return [this._minerAddr, this._extraData, ...this._transactions, ...this.prunedAccounts];
    }

    /**
     * @return {Hash}
     */
    hash() {
        if (!this._hash) {
            this._hash = MerkleTree.computeRoot(this.getMerkleLeafs());
        }
        return this._hash;
    }

    /**
     * @param {BlockBody} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof BlockBody
            && this._minerAddr.equals(o.minerAddr)
            && BufferUtils.equals(this._extraData, o.extraData)
            && this._transactions.length === o.transactions.length
            && this._transactions.every((tx, i) => tx.equals(o.transactions[i]));
    }

    /**
     * @return {Array.<Address>}
     */
    getAddresses() {
        const addresses = [this._minerAddr];
        for (const tx of this._transactions) {
            addresses.push(tx.sender, tx.recipient);
        }
        return addresses;
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

    /** @type {Array.<PrunedAccount>} */
    get prunedAccounts() {
        return this._prunedAccounts;
    }
}

Class.register(BlockBody);
