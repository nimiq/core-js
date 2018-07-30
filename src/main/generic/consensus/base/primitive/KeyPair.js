class KeyPair extends Serializable {
    /**
     * @param {PrivateKey} privateKey
     * @param {PublicKey} publicKey
     * @param {boolean} locked
     * @param {Uint8Array} lockSalt
     * @private
     */
    constructor(privateKey, publicKey, locked = false, lockSalt = null) {
        if (!(privateKey instanceof Object)) throw new Error('Primitive: Invalid type');
        if (!(publicKey instanceof Object)) throw new Error('Primitive: Invalid type');
        super();

        /** @type {boolean} */
        this._locked = locked;
        /** @type {boolean} */
        this._lockedInternally = locked;
        /** @type {Uint8Array} */
        this._lockSalt = lockSalt;
        /** @type {PublicKey} */
        this._publicKey = publicKey;
        /** @type {PrivateKey} */
        this._internalPrivateKey = new PrivateKey(privateKey.serialize());
    }

    /**
     * @return {KeyPair}
     */
    static generate() {
        const privateKey = PrivateKey.generate();
        return new KeyPair(privateKey, PublicKey.derive(privateKey));
    }

    /**
     * @param {PrivateKey} privateKey
     * @return {KeyPair}
     */
    static derive(privateKey) {
        return new KeyPair(privateKey, PublicKey.derive(privateKey));
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
        const decryptedData = await CryptoUtils.decryptOtpKdf(buf, key);
        return KeyPair.derive(new PrivateKey(decryptedData));
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
        return new KeyPair(privateKey, publicKey, locked, lockSalt);
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
        return this._publicKey || (this._publicKey = new PublicKey(this._obj.publicKey));
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

        const buf = CryptoUtils.encryptOtpKdf(this._privateKey.serialize(), key);

        if (wasLocked) this.relock();

        return buf;
    }

    /** @type {number} */
    get encryptedSize() {
        return CryptoUtils.ENCRYPTION_SIZE;
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
            CryptoWorker.lib.getRandomValues(this._lockSalt);
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
        const verifyPub = PublicKey.derive(privateKey);
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
        return new PrivateKey(await CryptoUtils.otpKdf(this._privateKey.serialize(), key, this._lockSalt, KeyPair.LOCK_KDF_ROUNDS));
    }

    get isLocked() {
        return this._locked;
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof KeyPair && super.equals(o);
    }
}
KeyPair.LOCK_KDF_ROUNDS = 256;

Class.register(KeyPair);
