class HashedTimeLockedContract extends Contract {
    /**
     * @param {number} balance
     * @param {Address} sender
     * @param {Address} recipient
     * @param {Hash} hashRoot
     * @param {number} hashCount
     * @param {number} timeout
     * @param {number} totalAmount
     */
    constructor(balance = 0, sender = Address.NULL, recipient = Address.NULL, hashRoot = Hash.NULL, hashCount = 1, timeout = 0, totalAmount = balance) {
        super(Account.Type.HTLC, balance);
        if (!(sender instanceof Address)) throw new Error('Malformed sender address');
        if (!(recipient instanceof Address)) throw new Error('Malformed recipient address');
        if (!(hashRoot instanceof Hash)) throw new Error('Malformed hashRoot');
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
     * @param {number} balance
     * @param {number} blockHeight
     * @param {Transaction} transaction
     */
    static create(balance, blockHeight, transaction) {
        const buf = new SerialBuffer(transaction.data);

        const sender = Address.unserialize(buf);
        const recipient = Address.unserialize(buf);
        const hashAlgorithm = /** @type {Hash.Algorithm} */ buf.readUint8();
        const hashRoot = Hash.unserialize(buf, hashAlgorithm);
        const hashCount = buf.readUint8();
        const timeout = buf.readUint32();

        return new HashedTimeLockedContract(balance, sender, recipient, hashRoot, hashCount, timeout);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {HashedTimeLockedContract}
     */
    static unserialize(buf) {
        const type = buf.readUint8();
        if (type !== Account.Type.HTLC) throw new Error('Invalid account type');

        const balance = buf.readUint64();
        const sender = Address.unserialize(buf);
        const recipient = Address.unserialize(buf);
        const hashAlgorithm = /** @type {Hash.Algorithm} */ buf.readUint8();
        const hashRoot = Hash.unserialize(buf, hashAlgorithm);
        const hashCount = buf.readUint8();
        const timeout = buf.readUint32();
        const totalAmount = buf.readUint64();
        return new HashedTimeLockedContract(balance, sender, recipient, hashRoot, hashCount, timeout, totalAmount);
    }

    /**
     * @param {object} plain
     */
    static fromPlain(plain) {
        if (!plain) throw new Error('Invalid account');
        return new HashedTimeLockedContract(plain.balance, Address.fromAny(plain.sender), Address.fromAny(plain.recipient), Hash.fromAny(plain.hashRoot, Hash.Algorithm.fromString(plain.hashAlgorithm)), plain.hashCount, plain.timeout, plain.totalAmount);
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
        buf.writeUint8(this._hashRoot.algorithm);
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
            + /*hashAlgorithm*/ 1
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
        return `HashedTimeLockedContract{balance=${this._balance}, sender=${this._sender.toUserFriendlyAddress(false)}, recipient=${this._sender.toUserFriendlyAddress(false)}, amount=${this._totalAmount}/${this._hashCount}, timeout=${this._timeout}}`;
    }

    /**
     * @returns {object}
     */
    toPlain() {
        const plain = super.toPlain();
        plain.sender = this.sender.toPlain();
        plain.recipient = this.recipient.toPlain();
        plain.hashAlgorithm = Hash.Algorithm.toString(this.hashRoot.algorithm);
        plain.hashRoot = this.hashRoot.toPlain();
        plain.hashCount = this.hashCount;
        plain.timeout = this.timeout;
        plain.totalAmount = this.totalAmount;
        return plain;
    }

    /**
     * Check if two Accounts are the same.
     * @param {Account} o Object to compare with.
     * @return {boolean} Set if both objects describe the same data.
     */
    equals(o) {
        return o instanceof HashedTimeLockedContract
            && this._type === o._type
            && this._balance === o._balance
            && this._sender.equals(o._sender)
            && this._recipient.equals(o._recipient)
            && this._hashRoot.equals(o._hashRoot)
            && this._hashCount === o._hashCount
            && this._timeout === o._timeout
            && this._totalAmount === o._totalAmount;
    }

    /**
     * @param {Transaction} transaction
     * @return {boolean}
     */
    static verifyOutgoingTransaction(transaction) {
        try {
            const buf = new SerialBuffer(transaction.proof);
            const type = buf.readUint8();
            switch (type) {
                case HashedTimeLockedContract.ProofType.REGULAR_TRANSFER: {
                    const hashAlgorithm = /** @type {Hash.Algorithm} */ buf.readUint8();
                    const hashDepth = buf.readUint8();
                    const hashRoot = Hash.unserialize(buf, hashAlgorithm);
                    let preImage = Hash.unserialize(buf, hashAlgorithm);

                    // Verify that the preImage hashed hashDepth times matches the _provided_ hashRoot.
                    for (let i = 0; i < hashDepth; ++i) {
                        preImage = Hash.compute(preImage.array, hashAlgorithm);
                    }
                    if (!hashRoot.equals(preImage)) {
                        return false;
                    }

                    // Signature proof of the HTLC recipient
                    if (!SignatureProof.unserialize(buf).verify(null, transaction.serializeContent())) {
                        return false;
                    }
                    break;
                }
                case HashedTimeLockedContract.ProofType.EARLY_RESOLVE: {
                    // Signature proof of the HTLC recipient
                    if (!SignatureProof.unserialize(buf).verify(null, transaction.serializeContent())) {
                        return false;
                    }

                    // Signature proof of the HTLC creator
                    if (!SignatureProof.unserialize(buf).verify(null, transaction.serializeContent())) {
                        return false;
                    }
                    break;
                }
                case HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE:
                    // Signature proof of the HTLC creator
                    if (!SignatureProof.unserialize(buf).verify(null, transaction.serializeContent())) {
                        return false;
                    }
                    break;
                default:
                    return false;
            }

            // Reject overlong proof.
            if (buf.readPos !== buf.byteLength) {
                return false;
            }

            return true; // Accept
        } catch (e) {
            return false;
        }
    }

    /**
     * @param {Transaction} transaction
     * @return {boolean}
     */
    static verifyIncomingTransaction(transaction) {
        try {
            const buf = new SerialBuffer(transaction.data);

            Address.unserialize(buf); // sender address
            Address.unserialize(buf); // recipient address
            const hashAlgorithm = /** @type {Hash.Algorithm} */ buf.readUint8();
            Hash.unserialize(buf, hashAlgorithm);
            const hashCount = buf.readUint8(); // hash count
            buf.readUint32(); // timeout

            if (hashCount === 0) {
                return false;
            }

            // Blacklist Argon2 hash function.
            if (hashAlgorithm === Hash.Algorithm.ARGON2D) {
                return false;
            }

            if (buf.readPos !== buf.byteLength) {
                return false;
            }

            return Contract.verifyIncomingTransaction(transaction);
        } catch (e) {
            return false;
        }
    }

    /**
     * @param {number} balance
     * @return {Account|*}
     */
    withBalance(balance) {
        return new HashedTimeLockedContract(balance, this._sender, this._recipient, this._hashRoot, this._hashCount, this._timeout, this._totalAmount);
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @param {boolean} [revert]
     * @return {Account|*}
     */
    withOutgoingTransaction(transaction, blockHeight, transactionsCache, revert = false) {
        const buf = new SerialBuffer(transaction.proof);
        const type = buf.readUint8();
        let minCap = 0;
        switch (type) {
            case HashedTimeLockedContract.ProofType.REGULAR_TRANSFER: {
                // Check that the contract has not expired yet.
                if (this._timeout < blockHeight) {
                    throw new Account.ProofError();
                }

                // Check that the provided hashRoot is correct.
                const hashAlgorithm = /** @type {Hash.Algorithm} */ buf.readUint8();
                const hashDepth = buf.readUint8();
                const hashRoot = Hash.unserialize(buf, hashAlgorithm);
                if (!hashRoot.equals(this._hashRoot)) {
                    throw new Account.ProofError();
                }

                // Ignore the preImage.
                Hash.unserialize(buf, hashAlgorithm);

                // Verify that the transaction is signed by the authorized recipient.
                if (!SignatureProof.unserialize(buf).isSignedBy(this._recipient)) {
                    throw new Account.ProofError();
                }

                minCap = Math.max(0, Math.floor((1 - (hashDepth / this._hashCount)) * this._totalAmount));

                break;
            }
            case HashedTimeLockedContract.ProofType.EARLY_RESOLVE: {
                if (!SignatureProof.unserialize(buf).isSignedBy(this._recipient)) {
                    throw new Account.ProofError();
                }

                if (!SignatureProof.unserialize(buf).isSignedBy(this._sender)) {
                    throw new Account.ProofError();
                }

                break;
            }
            case HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE: {
                if (this._timeout >= blockHeight) {
                    throw new Account.ProofError();
                }

                if (!SignatureProof.unserialize(buf).isSignedBy(this._sender)) {
                    throw new Account.ProofError();
                }

                break;
            }
            default:
                throw new Account.ProofError();
        }

        if (!revert) {
            const newBalance = this._balance - transaction.value - transaction.fee;
            if (newBalance < minCap) {
                throw new Account.BalanceError();
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
     * @param {Uint8Array} data
     * @return {object}
     */
    static dataToPlain(data) {
        try {
            const buf = new SerialBuffer(data);

            const sender = Address.unserialize(buf);
            const recipient = Address.unserialize(buf);
            const hashAlgorithm = /** @type {Hash.Algorithm} */ buf.readUint8();
            const hashRoot = Hash.unserialize(buf, hashAlgorithm);
            const hashCount = buf.readUint8();
            const timeout = buf.readUint32();

            return {
                sender: sender.toPlain(),
                recipient: recipient.toPlain(),
                hashAlgorithm: Hash.Algorithm.toString(hashAlgorithm),
                hashRoot: hashRoot.toPlain(),
                hashCount,
                timeout
            };
        } catch (e) {
            return Account.dataToPlain(data);
        }
    }

    /**
     * @param {Uint8Array} proof
     * @return {object}
     */
    static proofToPlain(proof) {
        try {
            const buf = new SerialBuffer(proof);
            const type = buf.readUint8();
            switch (type) {
                case HashedTimeLockedContract.ProofType.REGULAR_TRANSFER: {
                    const hashAlgorithm = /** @type {Hash.Algorithm} */ buf.readUint8();
                    const hashDepth = buf.readUint8();
                    const hashRoot = Hash.unserialize(buf, hashAlgorithm);
                    const preImage = Hash.unserialize(buf, hashAlgorithm);
                    const signatureProof = SignatureProof.unserialize(buf);

                    return {
                        type: HashedTimeLockedContract.ProofType.toString(type),
                        hashAlgorithm: Hash.Algorithm.toString(hashAlgorithm),
                        hashDepth,
                        hashRoot: hashRoot.toPlain(),
                        preImage: preImage.toPlain(),
                        signer: signatureProof.publicKey.toAddress().toPlain(),
                        signature: signatureProof.signature.toHex(),
                        publicKey: signatureProof.publicKey.toHex(),
                        pathLength: signatureProof.merklePath.nodes.length
                    };
                }
                case HashedTimeLockedContract.ProofType.EARLY_RESOLVE: {
                    const signatureProof = SignatureProof.unserialize(buf);
                    const creatorSignatureProof = SignatureProof.unserialize(buf);
                    return {
                        type: HashedTimeLockedContract.ProofType.toString(type),
                        signer: signatureProof.publicKey.toAddress().toPlain(),
                        signature: signatureProof.signature.toHex(),
                        publicKey: signatureProof.publicKey.toHex(),
                        pathLength: signatureProof.merklePath.nodes.length,
                        creator: creatorSignatureProof.publicKey.toAddress().toPlain(),
                        creatorSignature: creatorSignatureProof.signature.toHex(),
                        creatorPublicKey: creatorSignatureProof.publicKey.toHex(),
                        creatorPathLength: creatorSignatureProof.merklePath.nodes.length
                    };
                }
                case HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE: {
                    const creatorSignatureProof = SignatureProof.unserialize(buf);
                    return {
                        type: HashedTimeLockedContract.ProofType.toString(type),
                        creator: creatorSignatureProof.publicKey.toAddress().toPlain(),
                        creatorSignature: creatorSignatureProof.signature.toHex(),
                        creatorPublicKey: creatorSignatureProof.publicKey.toHex(),
                        creatorPathLength: creatorSignatureProof.merklePath.nodes.length
                    };
                }
                default:
                    return false;
            }
        } catch (e) {
            return Account.proofToPlain(proof);
        }
    }
}

HashedTimeLockedContract.ProofType = {
    REGULAR_TRANSFER: 1,
    EARLY_RESOLVE: 2,
    TIMEOUT_RESOLVE: 3
};

/**
 * @param {HashedTimeLockedContract.ProofType} proofType
 * @return {string}
 */
HashedTimeLockedContract.ProofType.toString = function(proofType) {
    switch (proofType) {
        case HashedTimeLockedContract.ProofType.REGULAR_TRANSFER: return 'regular-transfer';
        case HashedTimeLockedContract.ProofType.EARLY_RESOLVE: return 'early-resolve';
        case HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE: return 'timeout-resolve';
    }
    throw new Error('Invalid proof type');
};

Account.TYPE_MAP.set(Account.Type.HTLC, HashedTimeLockedContract);
Class.register(HashedTimeLockedContract);
