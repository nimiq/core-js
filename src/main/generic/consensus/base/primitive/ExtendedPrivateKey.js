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
     * @param {Uint8Array} seed
     * @return {ExtendedPrivateKey}
     */
    static generateMasterKey(seed) {
        const bCurve = BufferUtils.fromAscii('ed25519 seed');
        const hash = Hash.computeHmacSha512(bCurve, seed);
        return new ExtendedPrivateKey(new PrivateKey(hash.slice(0, 32)), hash.slice(32));
    }

    /**
     * @param {number} index
     * @return {ExtendedPrivateKey}
     */
    derive(index) {
        // Only hardened derivation is allowed for ed25519.
        if (index < 0x80000000) index += 0x80000000;

        const data = new SerialBuffer(1 + PrivateKey.SIZE + 4);
        data.writeUint8(0);
        this._key.serialize(data);
        data.writeUint32(index);

        const hash = Hash.computeHmacSha512(this._chainCode, data);
        return new ExtendedPrivateKey(new PrivateKey(hash.slice(0, 32)), hash.slice(32));
    }

    /**
     * @param {string} path
     * @return {boolean}
     */
    static isValidPath(path) {
        if (path.match(/^m(\/[0-9]+')*$/) === null) return false;

        // Overflow check.
        const segments = path.split('/');
        for (let i = 1; i < segments.length; i++) {
            if (!NumberUtils.isUint32(parseInt(segments[i]))) return false;
        }

        return true;
    }

    /**
     * @param {string} path
     * @return {ExtendedPrivateKey}
     */
    derivePath(path) {
        if (!ExtendedPrivateKey.isValidPath(path)) throw new Error('Invalid path');

        let extendedKey = this;
        const segments = path.split('/');
        for (let i = 1; i < segments.length; i++) {
            const index = parseInt(segments[i]);
            extendedKey = extendedKey.derive(index);
        }
        return extendedKey;
    }

    /**
     * @param {string} path
     * @param {Uint8Array} seed
     * @return {ExtendedPrivateKey}
     */
    static derivePathFromSeed(path, seed) {
        let extendedKey = ExtendedPrivateKey.generateMasterKey(seed);
        return extendedKey.derivePath(path);
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
