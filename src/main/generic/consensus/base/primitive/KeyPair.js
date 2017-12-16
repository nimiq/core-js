class KeyPair extends Primitive {
    /**
     * @param arg
     * @param {boolean} locked
     * @param {Uint8Array} lockSeed
     * @private
     */
    constructor(arg, locked = false, lockSeed = null) {
        super(arg, Crypto.keyPairType);
        /** @type {boolean} */
        this._locked = locked;
        /** @type {boolean} */
        this._unlocked = false;
        /** @type {Uint8Array} */
        this._lockSeed = lockSeed;
    }

    /**
     * @return {Promise.<KeyPair>}
     */
    static async generate() {
        return new KeyPair(await Crypto.keyPairGenerate());
    }

    /**
     * @param {PrivateKey} privateKey
     * @return {Promise.<KeyPair>}
     */
    static async derive(privateKey) {
        return new KeyPair(await Crypto.keyPairDerive(privateKey._obj));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {KeyPair}
     */
    static unserialize(buf) {
        const privateKey = PrivateKey.unserialize(buf);
        const publicKey = PublicKey.unserialize(buf);
        let locked = false;
        let lockSeed = null;
        if (buf.readPos < buf.byteLength) {
            const extra = buf.readUint8();
            if (extra === 1) {
                locked = true;
                lockSeed = buf.read(32);
            }
        }
        return new KeyPair(Crypto.keyPairFromKeys(privateKey._obj, publicKey._obj), locked, lockSeed);
    }

    /**
     * @param {string} hexBuf
     * @return {KeyPair}
     */
    static fromHex(hexBuf) {
        return this.unserialize(BufferUtils.fromHex(hexBuf));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._privateKeyInternal.serialize(buf);
        this.publicKey.serialize(buf);
        if (this._locked) {
            buf.writeUint8(1);
            buf.write(this._lockSeed);
        } else {
            buf.writeUint8(0);
        }
        return buf;
    }

    /** @type {PrivateKey} */
    get privateKey() {
        if (this.isLocked) throw new Error('Wallet is locked');
        return this._privateKeyInternal;
    }

    /** @type {PrivateKey} */
    get _privateKeyInternal() {
        return this._privateKey || (this._privateKey = new PrivateKey(Crypto.keyPairPrivate(this._obj)));
    }

    /** @type {PublicKey} */
    get publicKey() {
        return this._publicKey || (this._publicKey = new PublicKey(Crypto.keyPairPublic(this._obj)));
    }

    /** @type {number} */
    get serializedSize() {
        return this._privateKeyInternal.serializedSize + this.publicKey.serializedSize + (this._locked ? this._lockSeed.byteLength + 1 : 1);
    }

    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} [lockSeed]
     */
    async lock(key, lockSeed) {
        if (this._locked) throw new Error('KeyPair already locked');
        if (lockSeed) this._lockSeed = lockSeed;
        if (!this._lockSeed || this._lockSeed.length === 0) {
            this._lockSeed = new Uint8Array(32);
            Crypto.lib.getRandomValues(this._lockSeed);
        }
        this._privateKeyInternal.overwrite(await this._otpPrivateKey(key));
        this._locked = true;
        this._unlocked = false;
    }

    /**
     * @param {Uint8Array} key
     */
    async unlock(key) {
        if (!this._locked) throw new Error('KeyPair not locked');
        const privateKey = await this._otpPrivateKey(key);
        const verifyPub = await PublicKey.derive(privateKey);
        if (verifyPub.equals(this.publicKey)) {
            this._privateKey = privateKey;
            this._locked = false;
            this._unlocked = true;
        } else {
            throw new Error('Invalid key');
        }
    }

    relock() {
        if (this._locked) throw new Error('KeyPair already locked');
        if (!this._unlocked) throw new Error('KeyPair was never locked');
        this._privateKey.overwrite(PrivateKey.unserialize(new SerialBuffer(this._privateKey.serializedSize)));
        this._privateKey = null;
        this._locked = true;
        this._unlocked = false;
    }

    async _otpPrivateKey(key) {
        return new PrivateKey(KeyPair._xor(this._privateKeyInternal.serialize(), await Crypto.kdf(key, this._lockSeed)));
    }

    /**
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @return {Uint8Array}
     * @private
     */
    static _xor(a, b) {
        const res = new Uint8Array(a.byteLength);
        for (let i = 0; i < a.byteLength; ++i) {
            res[i] = a[i] ^ b[i];
        }
        return res;
    }

    get isLocked() {
        return this._locked;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof KeyPair && super.equals(o);
    }
}
KeyPair.LOCK_ROUNDS = 100;
Class.register(KeyPair);
