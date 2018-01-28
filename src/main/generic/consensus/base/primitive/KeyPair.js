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
        this._lockedInternally = locked;
        /** @type {Uint8Array} */
        this._lockSalt = lockSalt;

        this._internalPrivateKey = new PrivateKey(Crypto.keyPairPrivate(this._obj));
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
    static async fromPrivateKey(privateKey) {
        return new KeyPair(await Crypto.keyPairDerive(privateKey._obj));
    }

    /**
     * @param {string} hexBuf
     * @return {KeyPair}
     */
    static fromHex(hexBuf) {
        return KeyPair.unserialize(BufferUtils.fromHex(hexBuf));
    }

    /**
     *
     * @param {SerialBuffer} buf
     * @param {Uint8Array} key
     * @return {Promise<KeyPair>}
     */
    static async fromEncrypted(buf, key) {
        const encryptedKey = PrivateKey.unserialize(buf);
        const salt = buf.read(KeyPair.EXPORT_SALT_LENGTH);
        const check = buf.read(KeyPair.EXPORT_CHECKSUM_LENGTH);

        const privateKey = new PrivateKey(await KeyPair._otpKdf(encryptedKey.serialize(), key, salt, KeyPair.EXPORT_KDF_ROUNDS));
        const keyPair = await KeyPair.fromPrivateKey(privateKey);
        const pubHash = keyPair.publicKey.hash();
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
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._privateKey.serialize(buf);
        this.publicKey.serialize(buf);
        if (this._locked) {
            buf.writeUint8(1);
            buf.write(this._lockSalt);
        } else {
            buf.writeUint8(0);
        }
        return buf;
    }

    /**
     * The unlocked private key.
     * @type {PrivateKey}
     */
    get privateKey() {
        if (this.isLocked) throw new Error('Wallet is locked');
        return this._privateKey;
    }

    /**
     * The private key in its current state, i.e., depending on this._locked.
     * If this._locked, it is the internally locked private key.
     * If !this._locked, it is either the internally unlocked private key (if !this._lockedInternally)
     * or this._unlockedPrivateKey.
     * @type {PrivateKey}
     */
    get _privateKey() {
        return this._unlockedPrivateKey || this._internalPrivateKey;
    }

    /** @type {PublicKey} */
    get publicKey() {
        return this._publicKey || (this._publicKey = new PublicKey(Crypto.keyPairPublic(this._obj)));
    }

    /** @type {number} */
    get serializedSize() {
        return this._privateKey.serializedSize + this.publicKey.serializedSize + (this._locked ? this._lockSalt.byteLength + 1 : 1);
    }

    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} [unlockKey]
     * @return {Promise.<Uint8Array>}
     */
    async exportEncrypted(key, unlockKey) {
        const wasLocked = this._locked;
        if (this._locked) {
            try {
                await this.unlock(unlockKey || key);
            } catch (e) {
                throw new Error('KeyPair is locked and lock key mismatches');
            }
        }

        const salt = new Uint8Array(KeyPair.EXPORT_SALT_LENGTH);
        Crypto.lib.getRandomValues(salt);

        const buf = new SerialBuffer(this.encryptedSize);
        buf.write(await KeyPair._otpKdf(this.privateKey.serialize(), key, salt, KeyPair.EXPORT_KDF_ROUNDS));
        buf.write(salt);
        buf.write(this.publicKey.hash().subarray(0, KeyPair.EXPORT_CHECKSUM_LENGTH));

        if (wasLocked) this.relock();

        return buf;
    }

    /** @type {number} */
    get encryptedSize() {
        return this.privateKey.serializedSize + KeyPair.EXPORT_SALT_LENGTH + KeyPair.EXPORT_CHECKSUM_LENGTH;
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

        this._internalPrivateKey.overwrite(await this._otpPrivateKey(key));
        this._clearUnlockedPrivateKey();
        this._locked = true;
        this._lockedInternally = true;
    }

    /**
     * @param {Uint8Array} key
     */
    async unlock(key) {
        if (!this._locked) throw new Error('KeyPair not locked');

        const privateKey = await this._otpPrivateKey(key);
        const verifyPub = await PublicKey.derive(privateKey);
        if (verifyPub.equals(this.publicKey)) {
            // Only set this._internalPrivateKey, but keep this._obj locked.
            this._unlockedPrivateKey = privateKey;
            this._locked = false;
        } else {
            throw new Error('Invalid key');
        }
    }

    /**
     * Destroy cached unlocked private key if the internal key is in locked state.
     */
    relock() {
        if (this._locked) throw new Error('KeyPair already locked');
        if (!this._lockedInternally) throw new Error('KeyPair was never locked');
        this._clearUnlockedPrivateKey();
        this._locked = true;
    }

    _clearUnlockedPrivateKey() {
        // If this wallet is not locked internally and unlocked, this method does not have any effect.
        if (!this._lockedInternally || this._locked) return;

        // Overwrite cached key in this._unlockedPrivateKey with 0s.
        this._unlockedPrivateKey.overwrite(PrivateKey.unserialize(new SerialBuffer(this._unlockedPrivateKey.serializedSize)));
        // Then, reset it.
        this._unlockedPrivateKey = null;
    }

    /**
     * @param {Uint8Array} key
     * @return {Promise<PrivateKey>}
     * @private
     */
    async _otpPrivateKey(key) {
        return new PrivateKey(await KeyPair._otpKdf(this._privateKey.serialize(), key, this._lockSalt, KeyPair.LOCK_KDF_ROUNDS));
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
        return BufferUtils.xor(message, await Crypto.kdf(key, salt, iterations));
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
KeyPair.LOCK_KDF_ROUNDS = 256;
KeyPair.EXPORT_KDF_ROUNDS = 256;
KeyPair.EXPORT_CHECKSUM_LENGTH = 4;
KeyPair.EXPORT_SALT_LENGTH = 16;

Class.register(KeyPair);
