class VestingContract extends Contract {
    /**
     * @param {number} [balance]
     * @param {Address} [owner]
     * @param {number} [vestingStart]
     * @param {number} [vestingStepBlocks]
     * @param {number} [vestingStepAmount]
     * @param {number} [vestingTotalAmount]
     */
    constructor(balance = 0, owner = Address.NULL, vestingStart = 0, vestingStepBlocks = 0, vestingStepAmount = balance, vestingTotalAmount = balance) {
        super(Account.Type.VESTING, balance);
        if (!(owner instanceof Address)) throw new Error('Malformed address');
        if (!NumberUtils.isUint32(vestingStart)) throw new Error('Malformed vestingStart');
        if (!NumberUtils.isUint32(vestingStepBlocks)) throw new Error('Malformed vestingStepBlocks');
        if (!NumberUtils.isUint64(vestingStepAmount)) throw new Error('Malformed vestingStepAmount');
        if (!NumberUtils.isUint64(vestingTotalAmount)) throw new Error('Malformed lowerCap');

        /** @type {Address} */
        this._owner = owner;
        /** @type {number} */
        this._vestingStart = vestingStart;
        /** @type {number} */
        this._vestingStepBlocks = vestingStepBlocks;
        /** @type {number} */
        this._vestingStepAmount = vestingStepAmount;
        /** @type {number} */
        this._vestingTotalAmount = vestingTotalAmount;
    }

    /**
     * @param {number} balance
     * @param {number} blockHeight
     * @param {Transaction} transaction
     */
    static create(balance, blockHeight, transaction) {
        /** @type {number} */
        let vestingStart, vestingStepBlocks, vestingStepAmount, vestingTotalAmount;
        const buf = new SerialBuffer(transaction.data);
        const owner = Address.unserialize(buf);
        vestingTotalAmount = transaction.value;
        switch (transaction.data.length) {
            case Address.SERIALIZED_SIZE + 4:
                // Only block number: vest full amount at that block
                vestingStart = 0;
                vestingStepBlocks = buf.readUint32();
                vestingStepAmount = vestingTotalAmount;
                break;
            case Address.SERIALIZED_SIZE + 16:
                vestingStart = buf.readUint32();
                vestingStepBlocks = buf.readUint32();
                vestingStepAmount = buf.readUint64();
                break;
            case Address.SERIALIZED_SIZE + 24:
                // Create a vesting account with some instantly vested funds or additional funds considered.
                vestingStart = buf.readUint32();
                vestingStepBlocks = buf.readUint32();
                vestingStepAmount = buf.readUint64();
                vestingTotalAmount = buf.readUint64();
                break;
            default:
                throw new Error('Invalid transaction data');
        }
        return new VestingContract(balance, owner, vestingStart, vestingStepBlocks, vestingStepAmount, vestingTotalAmount);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {VestingContract}
     */
    static unserialize(buf) {
        const type = buf.readUint8();
        if (type !== Account.Type.VESTING) throw new Error('Invalid account type');

        const balance = buf.readUint64();
        const owner = Address.unserialize(buf);
        const vestingStart = buf.readUint32();
        const vestingStepBlocks = buf.readUint32();
        const vestingStepAmount = buf.readUint64();
        const vestingTotalAmount = buf.readUint64();
        return new VestingContract(balance, owner, vestingStart, vestingStepBlocks, vestingStepAmount, vestingTotalAmount);
    }

    /**
     * Serialize this VestingContract object into binary form.
     * @param {?SerialBuffer} [buf] Buffer to write to.
     * @return {SerialBuffer} Buffer from `buf` or newly generated one.
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._owner.serialize(buf);
        buf.writeUint32(this._vestingStart);
        buf.writeUint32(this._vestingStepBlocks);
        buf.writeUint64(this._vestingStepAmount);
        buf.writeUint64(this._vestingTotalAmount);
        return buf;
    }

    /**
     * @return {number}
     */
    get serializedSize() {
        return super.serializedSize
            + this._owner.serializedSize
            + /*vestingStart*/ 4
            + /*vestingStepBlocks*/ 4
            + /*vestingStepAmount*/ 8
            + /*vestingTotalAmount*/ 8;
    }

    /** @type {Address} */
    get owner() {
        return this._owner;
    }

    /** @type {number} */
    get vestingStart() {
        return this._vestingStart;
    }

    /** @type {number} */
    get vestingStepBlocks() {
        return this._vestingStepBlocks;
    }

    /** @type {number} */
    get vestingStepAmount() {
        return this._vestingStepAmount;
    }

    /** @type {number} */
    get vestingTotalAmount() {
        return this._vestingTotalAmount;
    }

    toString() {
        return `VestingAccount{balance=${this._balance}, owner=${this._owner.toUserFriendlyAddress()}`;
    }

    /**
     * Check if two Accounts are the same.
     * @param {Account} o Object to compare with.
     * @return {boolean} Set if both objects describe the same data.
     */
    equals(o) {
        return o instanceof VestingContract
            && this._type === o._type
            && this._balance === o._balance
            && this._owner.equals(o._owner)
            && this._vestingStart === o._vestingStart
            && this._vestingStepBlocks === o._vestingStepBlocks
            && this._vestingStepAmount === o._vestingStepAmount
            && this._vestingTotalAmount === o._vestingTotalAmount;
    }

    /**
     * @param {Transaction} transaction
     * @return {boolean}
     */
    static verifyOutgoingTransaction(transaction) {
        const buf = new SerialBuffer(transaction.proof);

        if (!SignatureProof.unserialize(buf).verify(null, transaction.serializeContent())) {
            return false;
        }

        if (buf.readPos !== buf.byteLength) {
            return false;
        }

        return true;
    }

    /**
     * @param {Transaction} transaction
     * @return {boolean}
     */
    static verifyIncomingTransaction(transaction) {
        switch (transaction.data.length) {
            case Address.SERIALIZED_SIZE + 4:
            case Address.SERIALIZED_SIZE + 16:
            case Address.SERIALIZED_SIZE + 24:
                return Contract.verifyIncomingTransaction(transaction);
            default:
                return false;
        }
    }

    /**
     * @param {number} balance
     * @return {VestingContract|*}
     */
    withBalance(balance) {
        return new VestingContract(balance, this._owner, this._vestingStart, this._vestingStepBlocks, this._vestingStepAmount, this._vestingTotalAmount);
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @param {boolean} [revert]
     * @return {Account|*}
     */
    withOutgoingTransaction(transaction, blockHeight, transactionsCache, revert = false) {
        if (!revert) {
            const minCap = this.getMinCap(blockHeight);
            const newBalance = this._balance - transaction.value - transaction.fee;
            if (newBalance < minCap) {
                throw new Error('Balance Error!');
            }

            const buf = new SerialBuffer(transaction.proof);
            if (!SignatureProof.unserialize(buf).isSignedBy(this._owner)) {
                throw new Error('Proof Error!');
            }
        }
        return super.withOutgoingTransaction(transaction, blockHeight, transactionsCache, revert);
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withIncomingTransaction(transaction, blockHeight, revert = false) {
        throw new Error('Illegal incoming transaction');
    }

    /**
     * @param {number} blockHeight
     * @returns {number}
     */
    getMinCap(blockHeight) {
        return this._vestingStepBlocks && this._vestingStepAmount > 0
            ? Math.max(0, this._vestingTotalAmount - Math.floor((blockHeight - this._vestingStart) / this._vestingStepBlocks) * this._vestingStepAmount)
            : 0;
    }
}

Account.TYPE_MAP.set(Account.Type.VESTING, VestingContract);
Class.register(VestingContract);
