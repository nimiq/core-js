class MultiSigWallet extends Wallet {
    /**
     * Create a new MultiSigWallet object.
     * @param {KeyPair} keyPair KeyPair owning this Wallet.
     * @param {number} minSignatures Number of signatures required.
     * @param {Array.<PublicKey>} publicKeys A list of all owners' public keys.
     * @returns {MultiSigWallet} A newly generated MultiSigWallet.
     */
    static fromPublicKeys(keyPair, minSignatures, publicKeys) {
        if (publicKeys.length === 0) throw new Error('publicKeys may not be empty');
        if (minSignatures <= 0) throw new Error('minSignatures must be greater than 0');

        const combinations = [...ArrayUtils.k_combinations(publicKeys, minSignatures)];
        const multiSigKeys = combinations.map(arr => PublicKey.sum(arr));
        return new MultiSigWallet(keyPair, minSignatures, multiSigKeys);
    }

    /**
     * @param {KeyPair} keyPair
     * @param {SerialBuffer} buf
     * @returns {MultiSigWallet}
     * @private
     */
    static _loadMultiSig(keyPair, buf) {
        const minSignatures = buf.readUint8();
        const numPublicKeys = buf.readUint8();
        const publicKeys = [];
        for (let i = 0; i < numPublicKeys; ++i) {
            publicKeys.push(PublicKey.unserialize(buf));
        }
        return new MultiSigWallet(keyPair, minSignatures, publicKeys);
    }

    /**
     * @param {Uint8Array|string} buf
     * @return {MultiSigWallet}
     */
    static loadPlain(buf) {
        if (typeof buf === 'string') buf = BufferUtils.fromHex(buf);
        if (!buf || buf.byteLength === 0) {
            throw new Error('Invalid wallet seed');
        }

        const serialBuf = new SerialBuffer(buf);
        const keyPair = KeyPair.unserialize(serialBuf);
        return MultiSigWallet._loadMultiSig(keyPair, serialBuf);
    }

    /**
     * @param {Uint8Array|string} buf
     * @param {Uint8Array|string} key
     * @return {Promise.<MultiSigWallet>}
     */
    static async loadEncrypted(buf, key) {
        if (typeof buf === 'string') buf = BufferUtils.fromHex(buf);
        if (typeof key === 'string') key = BufferUtils.fromAscii(key);

        const serialBuf = new SerialBuffer(buf);
        const keyPair = await KeyPair.fromEncrypted(serialBuf, key);
        return MultiSigWallet._loadMultiSig(keyPair, serialBuf);
    }

    /**
     * Create a new MultiSigWallet object.
     * @param {KeyPair} keyPair KeyPair owning this Wallet.
     * @param {number} minSignatures Number of signatures required.
     * @param {Array.<PublicKey>} publicKeys A list of all aggregated public keys.
     * @returns {MultiSigWallet} A newly generated MultiSigWallet.
     */
    constructor(keyPair, minSignatures, publicKeys) {
        super(keyPair);
        /** @type {number} minSignatures */
        this._minSignatures = minSignatures;
        /** @type {Array.<PublicKey>} publicKeys */
        this._publicKeys = publicKeys;
        this._publicKeys.sort((a, b) => a.compare(b));

        const merkleRoot = MerkleTree.computeRoot(this._publicKeys);
        /** @type {Address} */
        this._address = Address.fromHash(merkleRoot);
    }

    /**
     * @override
     * @returns {Uint8Array}
     */
    exportPlain() {
        const buf = new SerialBuffer(this.exportedSize);
        this._keyPair.serialize(buf);
        buf.writeUint8(this._minSignatures);
        buf.writeUint8(this._publicKeys.length);
        for (const pubKey of this._publicKeys) {
            pubKey.serialize(buf);
        }
        return buf;
    }

    /**
     * @override
     * @param {Uint8Array|string} key
     * @param {Uint8Array|string} [unlockKey]
     * @return {Promise.<Uint8Array>}
     */
    async exportEncrypted(key, unlockKey) {
        if (typeof key === 'string') key = BufferUtils.fromAscii(key);
        if (typeof unlockKey === 'string') unlockKey = BufferUtils.fromAscii(unlockKey);
        const buf = new SerialBuffer(this.encryptedExportedSize);
        buf.write(await this._keyPair.exportEncrypted(key, unlockKey));
        buf.writeUint8(this._minSignatures);
        buf.writeUint8(this._publicKeys.length);
        for (const pubKey of this._publicKeys) {
            pubKey.serialize(buf);
        }
        return buf;
    }

    /** @type {number} */
    get encryptedExportedSize() {
        return this._keyPair.encryptedSize
            + /*minSignatures*/ 1
            + /*count*/ 1
            + this._publicKeys.reduce((sum, pubKey) => sum + pubKey.serializedSize, 0);
    }

    /** @type {number} */
    get exportedSize() {
        return this._keyPair.serializedSize
            + /*minSignatures*/ 1
            + /*count*/ 1
            + this._publicKeys.reduce((sum, pubKey) => sum + pubKey.serializedSize, 0);
    }

    /**
     * Create a Transaction that still needs to be signed.
     * @param {Address} recipientAddr Address of the transaction receiver
     * @param {number} value Number of Satoshis to send.
     * @param {number} fee Number of Satoshis to donate to the Miner.
     * @param {number} validityStartHeight The validityStartHeight for the transaction.
     * @returns {Transaction} A prepared Transaction object.
     * @override
     */
    createTransaction(recipientAddr, value, fee, validityStartHeight) {
        return new ExtendedTransaction(this._address, Account.Type.BASIC,
            recipientAddr, Account.Type.BASIC, value, fee, validityStartHeight,
            Transaction.Flag.NONE, new Uint8Array(0));
    }

    /**
     * Creates a commitment pair for signing a transaction.
     * @returns {CommitmentPair} The commitment pair.
     */
    createCommitment() {
        return CommitmentPair.generate();
    }

    /**
     * @param {Transaction} transaction
     * @param {Array.<PublicKey>} publicKeys
     * @param {Commitment} aggregatedCommitment
     * @param {RandomSecret} secret
     * @returns {PartialSignature}
     */
    signTransaction(transaction, publicKeys, aggregatedCommitment, secret) {
        return PartialSignature.create(this._keyPair.privateKey, this._keyPair.publicKey, publicKeys,
            secret, aggregatedCommitment, transaction.serializeContent());
    }

    /**
     * @param {Transaction} transaction
     * @param {PublicKey} aggregatedPublicKey
     * @param {Commitment} aggregatedCommitment
     * @param {Array.<PartialSignature>} signatures
     * @returns {Transaction}
     */
    completeTransaction(transaction, aggregatedPublicKey, aggregatedCommitment, signatures) {
        if (signatures.length !== this._minSignatures) {
            throw 'Not enough signatures to complete this transaction';
        }

        const signature = Signature.fromPartialSignatures(aggregatedCommitment, signatures);
        const proof = SignatureProof.multiSig(aggregatedPublicKey, this._publicKeys, signature);
        transaction.proof = proof.serialize();
        return transaction;
    }

    /** @type {number} */
    get minSignatures() {
        return this._minSignatures;
    }

    /** @type {Array.<PublicKey>} */
    get publicKeys() {
        return this._publicKeys;
    }
}
Class.register(MultiSigWallet);
