if (typeof(require) !== 'undefined') {
    // we are in Node
    Nimiq = require('../../dist/node.js');
}

class HashMessageAuthenticationCode {
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
HashMessageAuthenticationCode.OUTER_PAD = 0x5C;
HashMessageAuthenticationCode.INNER_PAD = 0x36;
Class.register(HashMessageAuthenticationCode);