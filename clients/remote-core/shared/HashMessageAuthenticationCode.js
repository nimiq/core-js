if (typeof(window) === 'undefined') {
    // we are in Node
    Nimiq = require('../../../dist/node.js');
}

class HashMessageAuthenticationCode {
    /**
     * Compute the Hash Message Authetication code of a secret and a message.
     * @param {Nimiq.Hash|Uint8Array|string} secret
     * @param {string} message
     * @returns {Promise.<Nimiq.Hash>}
     */
    static async hmac(secret, message) {
        if (typeof(message) !== 'string' || Nimiq.StringUtils.isMultibyte(message)) {
            throw Error('Illegal message.');
        }
        const secretBuffer = await HashMessageAuthenticationCode._hmacSecretToBuffer(secret);
        const messageBuffer = Nimiq.BufferUtils.fromAscii(message);
        const outerPadded = HashMessageAuthenticationCode._xorPad(secretBuffer, HashMessageAuthenticationCode.OUTER_PAD);
        const innerPadded = HashMessageAuthenticationCode._xorPad(secretBuffer, HashMessageAuthenticationCode.INNER_PAD);
        const innerConcatenation = new Nimiq.SerialBuffer(innerPadded.byteLength + messageBuffer.byteLength);
        innerConcatenation.write(innerPadded);
        innerConcatenation.write(messageBuffer);
        const innerHash = (await Nimiq.Hash.light(innerConcatenation)).serialize();
        const outerConcatenation = new Nimiq.SerialBuffer(outerPadded.byteLength + innerHash.byteLength);
        outerConcatenation.write(outerPadded);
        outerConcatenation.write(innerHash);
        return await Nimiq.Hash.light(outerConcatenation);
    }

    /**
     * Convert a secret to a buffer of exactly the size of a hash.
     * @param {Nimiq.Hash|Uint8Array|string} secret
     * @returns {Promise.<Uint8Array>}
     */
    static async _hmacSecretToBuffer(secret) {
        const hashSize = Nimiq.Crypto.hashSize;
        if (Nimiq.Hash.isHash(secret)) {
            return secret.serialize();
        } else if (secret instanceof Uint8Array) {
            if (secret.byteLength === hashSize) {
                return secret;
            } else if (secret.byteLength > hashSize) {
                return await HashMessageAuthenticationCode._hmacSecretToBuffer(await Nimiq.Hash.light(secret));
            } else {
                // pad fill up the buffer to hash size
                let resultBuffer = new Nimiq.SerialBuffer(hashSize);
                resultBuffer.write(secret);
                resultBuffer.write(new Uint8Array(hashSize - secret.byteLength)); // fil up with zeros
                return resultBuffer;
            }
        } else if (typeof(secret) === 'string') {
            if (Nimiq.StringUtils.isMultibyte(secret)) {
                throw Error('Multi byte passwords not supported');
            }
            return await HashMessageAuthenticationCode._hmacSecretToBuffer(Nimiq.BufferUtils.fromAscii(secret));
        } else {
            throw Error('Unsupported secret format');
        }
    }

    /**
     * xor every entry of a buffer with a given pad.
     * @param {Uint8Array} buffer - The buffer which must have exactly the size of a hash. The buffer stays unchanged.
     * @param {number} pad - The pad which must be a Uint8.
     * @returns {Uint8Array} The result
     */
    static _xorPad(buffer, pad) {
        const hashSize = Nimiq.Crypto.hashSize;
        if (!(buffer instanceof Uint8Array) || buffer.byteLength!==hashSize) {
            throw Error('Invalid buffer');
        }
        if (!Nimiq.NumberUtils.isUint8(pad)) {
            throw Error('Pad must be an Uint8');
        }
        let resultBuffer = new Nimiq.SerialBuffer(hashSize);
        buffer.forEach(entry => {
            resultBuffer.writeUint8(entry ^ pad);
        });
        return resultBuffer;
    }
}
/** @const */
HashMessageAuthenticationCode.OUTER_PAD = 0x5C;
/** @const */
HashMessageAuthenticationCode.INNER_PAD = 0x36;
Class.register(HashMessageAuthenticationCode);