class CryptoUtils {
    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} data
     * @return {Uint8Array}
     */
    static computeHmacSha512(key, data) {
        if (key.length > CryptoUtils.SHA512_BLOCK_SIZE) {
            key = new SerialBuffer(Hash.computeSha512(key));
        }

        const iKey = new SerialBuffer(CryptoUtils.SHA512_BLOCK_SIZE);
        const oKey = new SerialBuffer(CryptoUtils.SHA512_BLOCK_SIZE);
        for (let i = 0; i < CryptoUtils.SHA512_BLOCK_SIZE; ++i) {
            const byte = key[i] || 0;
            iKey[i] = 0x36 ^ byte;
            oKey[i] = 0x5c ^ byte;
        }

        const innerHash = Hash.computeSha512(BufferUtils.concatTypedArrays(iKey, data));
        return Hash.computeSha512(BufferUtils.concatTypedArrays(oKey, innerHash));
    }

    /**
     * @param {Uint8Array} password
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @param {number} derivedKeyLength
     * @return {Uint8Array}
     */
    static computePBKDF2sha512(password, salt, iterations, derivedKeyLength) {
        // Following https://www.ietf.org/rfc/rfc2898.txt
        const hashLength = Hash.SIZE.get(Hash.Algorithm.SHA512);

        if (derivedKeyLength > (Math.pow(2, 32) - 1) * hashLength) {
            throw new Error('Derived key too long');
        }

        const l = Math.ceil(derivedKeyLength / hashLength);
        const r = derivedKeyLength - (l - 1) * hashLength;

        const derivedKey = new SerialBuffer(derivedKeyLength);
        for (let i = 1; i <= l; i++) {
            let u = new SerialBuffer(salt.length + 4);
            u.write(salt);
            u.writeUint32(i);

            u = CryptoUtils.computeHmacSha512(password, u);
            const t = u;
            for (let j = 1; j < iterations; j++) {
                u = CryptoUtils.computeHmacSha512(password, u);
                for (let k = 0; k < t.length; k++) {
                    t[k] ^= u[k];
                }
            }

            if (i < l) {
                derivedKey.write(t);
            } else {
                derivedKey.write(t.slice(0, r));
            }
        }
        return derivedKey;
    }

    /**
     * @param {Uint8Array} message
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @return {Promise<Uint8Array>}
     */
    static async otpKdf(message, key, salt, iterations) {
        return BufferUtils.xor(message, await (await CryptoWorker.getInstanceAsync()).kdf(key, salt, iterations));
    }

    /**
     * @param {Uint8Array} data
     * @param {Uint8Array} key
     * @return {Promise.<Uint8Array>}
     */
    static async encryptOtpKdf(data, key) {
        if (data.length !== CryptoUtils.ENCRYPTION_INPUT_SIZE) throw new Error('Invalid data size for encryption');

        const salt = new Uint8Array(CryptoUtils.ENCRYPTION_SALT_LENGTH);
        CryptoWorker.lib.getRandomValues(salt);

        const buf = new SerialBuffer(CryptoUtils.ENCRYPTION_SIZE);
        buf.writeUint8(2); // Argon2 KDF, Hash checksum
        buf.writeUint8(Math.log2(CryptoUtils.ENCRYPTION_KDF_ROUNDS));
        buf.write(await CryptoUtils.otpKdf(data, key, salt, CryptoUtils.ENCRYPTION_KDF_ROUNDS));
        buf.write(salt);
        buf.write(Hash.computeBlake2b(data).subarray(0, CryptoUtils.ENCRYPTION_CHECKSUM_LENGTH));
        return buf;
    }

    /**
     * @param {SerialBuffer} data
     * @param {Uint8Array} key
     * @return {Promise.<Uint8Array>}
     */
    static async decryptOtpKdf(data, key) {
        const type = data.readUint8();
        if (type !== 1 && type !== 2) throw new Error('Unsupported type');
        const roundsLog = data.readUint8();
        if (roundsLog > 32) throw new Error('Rounds out-of-bounds');
        const rounds = Math.pow(2, roundsLog);
        const encryptedData = data.read(CryptoUtils.ENCRYPTION_INPUT_SIZE);
        const salt = data.read(CryptoUtils.ENCRYPTION_SALT_LENGTH);
        const check = data.read(CryptoUtils.ENCRYPTION_CHECKSUM_LENGTH);

        const decryptedData = await CryptoUtils.otpKdf(encryptedData, key, salt, rounds);

        // Validate checksum.
        let checksum;
        switch (type) {
            case 1: {
                const privateKey = new PrivateKey(decryptedData);
                const publicKey = PublicKey.derive(privateKey);
                checksum = publicKey.hash();
                break;
            }
            case 2: {
                checksum = Hash.computeBlake2b(decryptedData);
                break;
            }
        }

        if (!BufferUtils.equals(checksum.subarray(0, CryptoUtils.ENCRYPTION_CHECKSUM_LENGTH), check)) {
            throw new Error('Invalid key');
        }

        return decryptedData;
    }
}
CryptoUtils.SHA512_BLOCK_SIZE = 128;
CryptoUtils.ENCRYPTION_INPUT_SIZE = 32;
CryptoUtils.ENCRYPTION_KDF_ROUNDS = 256;
CryptoUtils.ENCRYPTION_CHECKSUM_LENGTH = 4;
CryptoUtils.ENCRYPTION_SALT_LENGTH = 16;
CryptoUtils.ENCRYPTION_SIZE = /*version + rounds*/ 2 + CryptoUtils.ENCRYPTION_INPUT_SIZE + CryptoUtils.ENCRYPTION_SALT_LENGTH + CryptoUtils.ENCRYPTION_CHECKSUM_LENGTH;

Class.register(CryptoUtils);
