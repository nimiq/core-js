class PublicKey extends Primitive {
    /**
     * @param {PublicKey} o
     * @returns {PublicKey}
     */
    static copy(o) {
        if (!o) return o;
        return new PublicKey(new Uint8Array(o._obj));
    }

    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.publicKeyType, Crypto.publicKeySize);
    }

    /**
     * @param {PrivateKey} privateKey
     * @return {Promise.<PublicKey>}
     */
    static async derive(privateKey) {
        return new PublicKey(await Crypto.publicKeyDerive(privateKey._obj));
    }

    /**
     * @param {Array.<PublicKey>} publicKeys
     * @return {Promise.<PublicKey>}
     */
    static async sum(publicKeys) {
        return new PublicKey(await Crypto.aggregatePublicKeys(publicKeys.map(key => key._obj)));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PublicKey}
     */
    static unserialize(buf) {
        return new PublicKey(Crypto.publicKeyUnserialize(buf.read(Crypto.publicKeySize)));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.publicKeySerialize(this._obj));
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Crypto.publicKeySize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PublicKey && super.equals(o);
    }

    /**
     * @return {Promise.<Hash>}
     */
    hash() {
        return Hash.light(this.serialize());
    }

    /**
     * @return {Hash}
     */
    hashSync() {
        return Hash.lightSync(this.serialize());
    }

    /**
     * @param {PublicKey} o
     * @return {number}
     */
    compare(o) {
        return BufferUtils.compare(this._obj, o._obj);
    }

    /**
     * @return {Promise.<Address>}
     */
    async toAddress() {
        return Address.fromHash(await this.hash());
    }

    /**
     * @return {Address}
     */
    toAddressSync() {
        return Address.fromHash(Hash.lightSync(this.serialize()));
    }

    /**
     * @return {Promise.<SignalId>}
     */
    async toSignalId() {
        return new SignalId((await this.hash()).subarray(0, 16));
    }
}

Class.register(PublicKey);
