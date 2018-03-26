class Wallet {
    /**
     * Create a new Wallet.
     * @returns {Promise.<Wallet>} Newly created Wallet.
     */
    static async generate() {
        return new Wallet(KeyPair.generate());
    }

    /**
     * @param {Uint8Array|string} buf
     * @return {Wallet}
     */
    static loadPlain(buf) {
        if (typeof buf === 'string') buf = BufferUtils.fromHex(buf);
        if (!buf || buf.byteLength === 0) {
            throw new Error('Invalid wallet seed');
        }
        return new Wallet(KeyPair.unserialize(new SerialBuffer(buf)));
    }

    /**
     * @param {Uint8Array|string} buf
     * @param {Uint8Array|string} key
     * @return {Promise.<Wallet>}
     */
    static async loadEncrypted(buf, key) {
        if (typeof buf === 'string') buf = BufferUtils.fromHex(buf);
        if (typeof key === 'string') key = BufferUtils.fromAscii(key);
        return new Wallet(await KeyPair.fromEncrypted(new SerialBuffer(buf), key));
    }

    /**
     * Create a new Wallet object.
     * @param {KeyPair} keyPair KeyPair owning this Wallet.
     * @returns {Wallet} A newly generated Wallet.
     */
    constructor(keyPair) {
        /** @type {KeyPair} */
        this._keyPair = keyPair;
        /** @type {Address} */
        this._address = this._keyPair.publicKey.toAddress();
    }

    /**
     * Create a Transaction that is signed by the owner of this Wallet.
     * @param {Address} recipient Address of the transaction receiver
     * @param {number} value Number of Satoshis to send.
     * @param {number} fee Number of Satoshis to donate to the Miner.
     * @param {number} validityStartHeight The validityStartHeight for the transaction.
     * @returns {Transaction} A prepared and signed Transaction object. This still has to be sent to the network.
     */
    createTransaction(recipient, value, fee, validityStartHeight) {
        const transaction = new BasicTransaction(this._keyPair.publicKey, recipient, value, fee, validityStartHeight);
        transaction.signature = Signature.create(this._keyPair.privateKey, this._keyPair.publicKey, transaction.serializeContent());
        return transaction;
    }

    /**
     * Sign a transaction by the owner of this Wallet.
     * @param {Transaction} transaction The transaction to sign.
     * @returns {SignatureProof} A signature proof for this transaction.
     */
    signTransaction(transaction) {
        const signature = Signature.create(this._keyPair.privateKey, this._keyPair.publicKey, transaction.serializeContent());
        return SignatureProof.singleSig(this._keyPair.publicKey, signature);
    }

    /**
     * @returns {Uint8Array}
     */
    exportPlain() {
        return this._keyPair.serialize();
    }

    /**
     * @param {Uint8Array|string} key
     * @param {Uint8Array|string} [unlockKey]
     * @return {Promise.<Uint8Array>}
     */
    exportEncrypted(key, unlockKey) {
        if (typeof key === 'string') key = BufferUtils.fromAscii(key);
        if (typeof unlockKey === 'string') unlockKey = BufferUtils.fromAscii(unlockKey);
        return this._keyPair.exportEncrypted(key, unlockKey);
    }

    /** @type {boolean} */
    get isLocked() {
        return this.keyPair.isLocked;
    }

    /**
     * @param {Uint8Array|string} key
     * @returns {Promise.<void>}
     */
    lock(key) {
        if (typeof key === 'string') key = BufferUtils.fromAscii(key);
        return this.keyPair.lock(key);
    }

    relock() {
        this.keyPair.relock();
    }

    /**
     * @param {Uint8Array|string} key
     * @returns {Promise.<void>}
     */
    unlock(key) {
        if (typeof key === 'string') key = BufferUtils.fromAscii(key);
        return this.keyPair.unlock(key);
    }

    /**
     * @param {Wallet} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Wallet && this.keyPair.equals(o.keyPair) && this.address.equals(o.address);
    }

    /**
     * The address of the Wallet owner.
     * @type {Address}
     */
    get address() {
        return this._address;
    }

    /**
     * The public key of the Wallet owner
     * @type {PublicKey}
     */
    get publicKey() {
        return this._keyPair.publicKey;
    }

    /** @type {KeyPair} */
    get keyPair() {
        return this._keyPair;
    }
}

Class.register(Wallet);
