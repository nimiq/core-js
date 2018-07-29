class ExtendedPrivateKey extends Serializable {
    /**
     * @param {PrivateKey} key
     * @param {Uint8Array} chainCode
     * @private
     */
    constructor(key, chainCode) {
        super();
        if (!(key instanceof PrivateKey)) throw new Error('ExtendedPrivateKey: Invalid key');
        if (!(chainCode instanceof Uint8Array)) throw new Error('ExtendedPrivateKey: Invalid chainCode');
        if (chainCode.length !== ExtendedPrivateKey.CHAIN_CODE_SIZE) throw new Error('ExtendedPrivateKey: Invalid chainCode length');
        this._key = key;
        this._chainCode = chainCode;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {ExtendedPrivateKey}
     */
    static unserialize(buf) {
        const privateKey = PrivateKey.unserialize(buf);
        const chainCode = buf.read(ExtendedPrivateKey.CHAIN_CODE_SIZE);
        return new ExtendedPrivateKey(privateKey, chainCode);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._key.serialize(buf);
        buf.write(this._chainCode);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this._key.serializedSize + ExtendedPrivateKey.CHAIN_CODE_SIZE;
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof ExtendedPrivateKey && super.equals(o);
    }

    /**
     * @type {PrivateKey}
     */
    get privateKey() {
        return this._key;
    }

    /**
     * @return {Address}
     */
    toAddress() {
        return PublicKey.derive(this._key).toAddress();
    }
}

ExtendedPrivateKey.CHAIN_CODE_SIZE = 32;

Class.register(ExtendedPrivateKey);
