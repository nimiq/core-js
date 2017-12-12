class HashedTimeLockedContract extends Account {

    /**
     * @param {number} balance
     * @param {number} nonce
     * @param {Address} sender
     * @param {Address} recipient
     * @param {Hash} hashRoot
     * @param {number} hashCount
     * @param {number} timeout
     * @param {number} totalAmount
     */
    constructor(balance = 0, nonce = 0, sender = Address.NULL, recipient = Address.NULL, hashRoot = Hash.NULL, hashCount = 1, timeout = 0, totalAmount = balance) {
        super(Account.Type.HTLC, balance, nonce);
        if (!(sender instanceof Address)) throw new Error('Malformed address');
        if (!(recipient instanceof Address)) throw new Error('Malformed address');
        if (!(hashRoot instanceof Hash)) throw new Error('Malformed address');
        if (!NumberUtils.isUint8(hashCount) || hashCount === 0) throw new Error('Malformed hashCount');
        if (!NumberUtils.isUint32(timeout)) throw new Error('Malformed timeout');
        if (!NumberUtils.isUint64(totalAmount)) throw new Error('Malformed totalAmount');

        /** @type {Address} */
        this._sender = sender;
        /** @type {Address} */
        this._recipient = recipient;
        /** @type {Hash} */
        this._hashRoot = hashRoot;
        /** @type {number} */
        this._hashCount = hashCount;
        /** @type {number} */
        this._timeout = timeout;
        /** @type {number} */
        this._totalAmount = totalAmount;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {HashedTimeLockedContract}
     */
    static unserialize(buf) {
        const type = buf.readUint8();
        if (type !== Account.Type.HTLC) throw new Error('Invalid account type');

        const balance = buf.readUint64();
        const nonce = buf.readUint32();
        const sender = Address.unserialize(buf);
        const recipient = Address.unserialize(buf);
        const hashRoot = Hash.unserialize(buf);
        const hashCount = buf.readUint8();
        const timeout = buf.readUint32();
        const totalAmount = buf.readUint64();
        return new HashedTimeLockedContract(balance, nonce, sender, recipient, hashRoot, hashCount, timeout, totalAmount);
    }


    /**
     * Serialize this HTLC object into binary form.
     * @param {?SerialBuffer} [buf] Buffer to write to.
     * @return {SerialBuffer} Buffer from `buf` or newly generated one.
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._sender.serialize(buf);
        this._recipient.serialize(buf);
        this._hashRoot.serialize(buf);
        buf.writeUint8(this._hashCount);
        buf.writeUint32(this._timeout);
        buf.writeUint64(this._totalAmount);
        return buf;
    }

    /**
     * @return {number}
     */
    get serializedSize() {
        return super.serializedSize
            + this._sender.serializedSize
            + this._recipient.serializedSize
            + this._hashRoot.serializedSize
            + /*hashCount*/ 1
            + /*timeout*/ 4
            + /*totalAmount*/ 8;
    }

    /** @type {Address} */
    get sender() {
        return this._sender;
    }

    /** @type {Address} */
    get recipient() {
        return this._recipient;
    }

    /** @type {Hash} */
    get hashRoot() {
        return this._hashRoot;
    }

    /** @type {number} */
    get hashCount() {
        return this._hashCount;
    }

    /** @type {number} */
    get timeout() {
        return this._timeout;
    }

    /** @type {number} */
    get totalAmount() {
        return this._totalAmount;
    }

    toString() {
        return `HashedTimeLockedContract{sender=${this._sender.toUserFriendlyAddress(false)}, recipient=${this._sender.toUserFriendlyAddress(false)} amount=${this._totalAmount}/${this._hashCount}, timeout=${this._timeout}, balance=${this._balance}, nonce=${this._nonce}}`;
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    static async verifyOutgoingTransaction(transaction) {
        if (transaction.proof.length === 0) return false;
        const buf = new SerialBuffer(transaction.proof);
        const type = buf.readUint8();
        switch (type) {
            case HashedTimeLockedContract.ProofType.REGULAR_TRANSFER: {
                // pre-image
                const hashDepth = buf.readUint8();
                const rootHash = Hash.unserialize(buf);
                let hashTmp = buf.read(Crypto.hashSize);
                for (let i = 0; i < hashDepth; ++i) {
                    hashTmp = await Crypto.hashLight(hashTmp);
                }
                if (!rootHash.equals(new Hash(hashTmp))) {
                    return false;
                }

                // signature proof of the htlc recipient
                return SignatureProof.unserialize(buf).verify(transaction.recipient, transaction.serializeContent());
            }
            case HashedTimeLockedContract.ProofType.EARLY_RESOLVE: {
                // signature proof of the htlc recipient
                const htlcRecipientAddress = Address.unserialize(buf);
                if (!(await SignatureProof.unserialize(buf).verify(htlcRecipientAddress, transaction.serializeContent()))) {
                    return false;
                }

                // signature proof of the htlc creator
                return SignatureProof.unserialize(buf).verify(transaction.recipient, transaction.serializeContent());
            }
            case HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE:
                // signature proof of the htlc creator
                return SignatureProof.unserialize(buf).verify(transaction.recipient, transaction.serializeContent());
            default:
                return false;
        }
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    static async verifyIncomingTransaction(transaction) {
        if (transaction.data.length !== Address.SERIALIZED_SIZE + Crypto.hashSize + 5) {
            return false;
        }

        const buf = new SerialBuffer(transaction.data);
        const recipient = Address.unserialize(buf);
        const hashRoot = Hash.unserialize(buf);
        const hashCount = buf.readUint8();
        const timeout = buf.readUint32();

        const contract = new HashedTimeLockedContract(transaction.value, 0, transaction.sender, recipient, hashRoot, hashCount, timeout);
        const hash = await Hash.light(contract.serialize());
        if (!transaction.recipient.equals(Address.fromHash(hash))) {
            return false;
        }

        return true; // Accept
    }

    /**
     * @param {number} balance
     * @param {number} [nonce]
     * @return {Account|*}
     */
    withBalance(balance, nonce) {
        return new HashedTimeLockedContract(balance, typeof nonce === 'undefined' ? this._nonce : nonce, this._sender, this._recipient, this._hashRoot, this._hashCount, this._timeout, this._totalAmount);
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account|*}
     */
    withOutgoingTransaction(transaction, blockHeight, revert = false) {
        const buf = new SerialBuffer(transaction.proof);
        const type = buf.readUint8();
        let minCap = 0;
        switch (type) {
            case HashedTimeLockedContract.ProofType.REGULAR_TRANSFER: {
                if (!transaction.recipient.equals(this._recipient)) {
                    throw new Error('Proof Error!');
                }

                if (this._timeout < blockHeight) {
                    throw new Error('Proof Error!');
                }

                const hashDepth = buf.readUint8();
                if (!Hash.unserialize(buf).equals(this._hashRoot)) {
                    throw new Error('Proof Error!');
                }

                minCap = Math.max(0, Math.floor((1 - (hashDepth / this._hashCount)) * this._totalAmount));

                break;
            }
            case HashedTimeLockedContract.ProofType.EARLY_RESOLVE: {
                if (!transaction.recipient.equals(this._sender)) {
                    throw new Error('Proof Error!');
                }

                if (!Address.unserialize(buf).equals(this._recipient)) {
                    throw new Error('Proof Error!');
                }

                break;
            }
            case HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE: {
                if (!transaction.recipient.equals(this._sender)) {
                    throw new Error('Proof Error!');
                }

                if (this._timeout > blockHeight) {
                    throw new Error('Proof Error!');
                }

                break;
            }
            default:
                throw new Error('Proof Error!');
        }
        if (!revert) {
            const newBalance = this._balance - transaction.value - transaction.fee;
            if (newBalance < minCap) {
                throw new Error('Balance Error!');
            }
        }
        return super.withOutgoingTransaction(transaction, blockHeight, revert);
    }


    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withIncomingTransaction(transaction, blockHeight, revert = false) {
        if (this === HashedTimeLockedContract.INITIAL) {
            const buf = new SerialBuffer(transaction.data);
            const recipient = Address.unserialize(buf);
            const hashRoot = Hash.unserialize(buf);
            const hashCount = buf.readUint8();
            const timeout = buf.readUint32();

            return new HashedTimeLockedContract(transaction.value, 0, transaction.sender, recipient, hashRoot, hashCount, timeout);
        } else if (revert && transaction.data.length > 0) {
            return HashedTimeLockedContract.INITIAL;
        } else {
            // No incoming transactions after creation
            throw new Error('Data Error!');
        }
    }
}

HashedTimeLockedContract.ProofType = {
    REGULAR_TRANSFER: 1,
    EARLY_RESOLVE: 2,
    TIMEOUT_RESOLVE: 3
};
HashedTimeLockedContract.INITIAL = new HashedTimeLockedContract();
Account.TYPE_MAP.set(Account.Type.HTLC, HashedTimeLockedContract);
Class.register(HashedTimeLockedContract);
