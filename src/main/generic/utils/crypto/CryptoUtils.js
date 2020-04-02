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
     * @return {SerialBuffer}
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
     * @return {Promise.<Uint8Array>}
     * @deprecated
     */
    static async otpKdfLegacy(message, key, salt, iterations) {
        const worker = await CryptoWorker.getInstanceAsync();
        const derivedKey = await worker.kdfLegacy(key, salt, iterations, message.byteLength);
        return BufferUtils.xor(message, derivedKey);
    }

    /**
     * @param {Uint8Array} message
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @return {Promise.<Uint8Array>}
     */
    static async otpKdf(message, key, salt, iterations) {
        const worker = await CryptoWorker.getInstanceAsync();
        const derivedKey = await worker.kdf(key, salt, iterations, message.byteLength);
        return BufferUtils.xor(message, derivedKey);
    }

}
CryptoUtils.SHA512_BLOCK_SIZE = 128;

Class.register(CryptoUtils);
