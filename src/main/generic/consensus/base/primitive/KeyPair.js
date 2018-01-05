class KeyPair extends Primitive {
    /**
     * @param arg
     * @param {boolean} locked
     * @param {Uint8Array} lockSalt
     * @private
     */
    constructor(arg, locked = false, lockSalt = null) {
        super(arg, Crypto.keyPairType);
        /** @type {boolean} */
        this._locked = locked;
        /** @type {boolean} */
        this._unlocked = false;
        /** @type {Uint8Array} */
        this._lockSalt = lockSalt;
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
     *
     * @param {SerialBuffer} buf
     * @param {Uint8Array} key
     * @return {Promise<KeyPair>}
     */
    static async deriveDeepLocked(buf, key) {
        const encryptedKey = PrivateKey.unserialize(buf);
        const salt = buf.read(KeyPair.DEEP_LOCK_SALT_LENGTH);
        const check = buf.read(KeyPair.DEEP_LOCK_CHECKSUM_LENGTH);

        const privateKey = new PrivateKey(await KeyPair._otpKdf(encryptedKey.serialize(), key, salt, KeyPair.DEEP_LOCK_ROUNDS));
        const keyPair = await KeyPair.derive(privateKey);
        const pubHash = await keyPair.publicKey.hash();
        if (!BufferUtils.equals(pubHash.subarray(0, 4), check)) {
            throw new Error('Invalid key');
        }
        return keyPair;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {KeyPair}
     */
    static unserialize(buf) {
        const privateKey = PrivateKey.unserialize(buf);
        const publicKey = PublicKey.unserialize(buf);
        let locked = false;
        let lockSalt = null;
        if (buf.readPos < buf.byteLength) {
            const extra = buf.readUint8();
            if (extra === 1) {
                locked = true;
                lockSalt = buf.read(32);
            }
        }
        return new KeyPair(Crypto.keyPairFromKeys(privateKey._obj, publicKey._obj), locked, lockSalt);
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
            buf.write(this._lockSalt);
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
        return this._privateKeyInternal.serializedSize + this.publicKey.serializedSize + (this._locked ? this._lockSalt.byteLength + 1 : 1);
    }

    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} [lockSalt]
     */
    async lock(key, lockSalt) {
        if (this._locked) throw new Error('KeyPair already locked');
        if (lockSalt) this._lockSalt = lockSalt;
        if (!this._lockSalt || this._lockSalt.length === 0) {
            this._lockSalt = new Uint8Array(32);
            Crypto.lib.getRandomValues(this._lockSalt);
        }
        this._privateKeyInternal.overwrite(await this._otpPrivateKey(key));
        this._locked = true;
        this._unlocked = false;
    }

    /**
     * @param {Uint8Array} key
     * @return {Promise.<Uint8Array>}
     */
    async deepLock(key) {
        const wasLocked = this._locked;
        if (this._locked) {
            try {
                await this.unlock(key);
            } catch (e) {
                throw new Error('KeyPair is locked but deep lock key mismatches');
            }
        }

        const salt = new Uint8Array(KeyPair.DEEP_LOCK_SALT_LENGTH);
        Crypto.lib.getRandomValues(salt);

        const buf = new SerialBuffer(this.privateKey.serializedSize + KeyPair.DEEP_LOCK_SALT_LENGTH + KeyPair.DEEP_LOCK_CHECKSUM_LENGTH);
        buf.write(await KeyPair._otpKdf(this.privateKey.serialize(), key, salt, KeyPair.DEEP_LOCK_ROUNDS));
        buf.write(salt);
        buf.write((await this.publicKey.hash()).subarray(0, KeyPair.DEEP_LOCK_CHECKSUM_LENGTH));

        if (wasLocked) this.relock();

        return buf;
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

    /**
     * @param {Uint8Array} key
     * @return {Promise<PrivateKey>}
     * @private
     */
    async _otpPrivateKey(key) {
        return new PrivateKey(await KeyPair._otpKdf(this._privateKeyInternal.serialize(), key, this._lockSalt, KeyPair.LOCK_ROUNDS));
    }

    /**
     * @param {Uint8Array} message
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @return {Promise<Uint8Array>}
     * @private
     */
    static async _otpKdf(message, key, salt, iterations) {
        return KeyPair._xor(message, await Crypto.kdf(key, salt, iterations));
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
KeyPair.LOCK_ROUNDS = 256;
KeyPair.DEEP_LOCK_ROUNDS = 32768;
KeyPair.DEEP_LOCK_CHECKSUM_LENGTH = 4;
KeyPair.DEEP_LOCK_SALT_LENGTH = 16;

Class.register(KeyPair);
