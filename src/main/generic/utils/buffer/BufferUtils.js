class BufferUtils {
    /**
     * @param {*} buffer
     * @return {string}
     */
    static toAscii(buffer) {
        return String.fromCharCode.apply(null, new Uint8Array(buffer));
    }

    /**
     * @param {string} string
     * @return {Uint8Array}
     */
    static fromAscii(string) {
        const buf = new Uint8Array(string.length);
        for (let i = 0; i < string.length; ++i) {
            buf[i] = string.charCodeAt(i);
        }
        return buf;
    }

    static _codePointTextDecoder(u8) {
        if (typeof TextDecoder === 'undefined') throw new Error('TextDecoder not supported');
        if (BufferUtils._ISO_8859_15_DECODER === null) throw new Error('TextDecoder does not supprot iso-8859-15');
        if (BufferUtils._ISO_8859_15_DECODER === undefined) {
            try {
                BufferUtils._ISO_8859_15_DECODER = new TextDecoder('iso-8859-15');
            } finally {
                BufferUtils._ISO_8859_15_DECODER = null;
            }
        }
        return BufferUtils._ISO_8859_15_DECODER.decode(u8)
            .replace('€', '¤').replace('Š', '¦').replace('š', '¨').replace('Ž', '´')
            .replace('ž', '¸').replace('Œ', '¼').replace('œ', '½').replace('Ÿ', '¾');
    }

    static _tripletToBase64(num) {
        return BufferUtils._BASE64_LOOKUP[num >> 18 & 0x3F] + BufferUtils._BASE64_LOOKUP[num >> 12 & 0x3F] + BufferUtils._BASE64_LOOKUP[num >> 6 & 0x3F] + BufferUtils._BASE64_LOOKUP[num & 0x3F];
    }

    static _base64encodeChunk(u8, start, end) {
        let tmp;
        const output = [];
        for (let i = start; i < end; i += 3) {
            tmp = ((u8[i] << 16) & 0xFF0000) + ((u8[i + 1] << 8) & 0xFF00) + (u8[i + 2] & 0xFF);
            output.push(BufferUtils._tripletToBase64(tmp));
        }
        return output.join('');
    }

    static _base64fromByteArray(u8) {
        let tmp;
        const len = u8.length;
        const extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
        let output = '';
        const parts = [];
        const maxChunkLength = 16383; // must be multiple of 3

        // go through the array every three bytes, we'll deal with trailing stuff later
        for (let i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
            parts.push(BufferUtils._base64encodeChunk(u8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
        }

        // pad the end with zeros, but make sure to not forget the extra bytes
        if (extraBytes === 1) {
            tmp = u8[len - 1];
            output += BufferUtils._BASE64_LOOKUP[tmp >> 2];
            output += BufferUtils._BASE64_LOOKUP[(tmp << 4) & 0x3F];
            output += '==';
        } else if (extraBytes === 2) {
            tmp = (u8[len - 2] << 8) + (u8[len - 1]);
            output += BufferUtils._BASE64_LOOKUP[tmp >> 10];
            output += BufferUtils._BASE64_LOOKUP[(tmp >> 4) & 0x3F];
            output += BufferUtils._BASE64_LOOKUP[(tmp << 2) & 0x3F];
            output += '=';
        }

        parts.push(output);

        return parts.join('');
    }

    /**
     * @param {*} buffer
     * @return {string}
     */
    static toBase64(buffer) {
        if (PlatformUtils.isNodeJs()) {
            return Buffer.from(buffer).toString('base64');
        } else if (typeof TextDecoder !== 'undefined' && BufferUtils._ISO_8859_15_DECODER !== null) {
            try {
                return btoa(BufferUtils._codePointTextDecoder(new Uint8Array(buffer)));
            } catch (e) {
                // Disabled itself
            }
        }

        return BufferUtils._base64fromByteArray(new Uint8Array(buffer));
    }

    /**
     * @param {string} base64
     * @return {SerialBuffer}
     */
    static fromBase64(base64) {
        return new SerialBuffer(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
    }

    /**
     * @param {*} buffer
     * @return {string}
     */
    static toBase64Url(buffer) {
        return BufferUtils.toBase64(buffer).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '.');
    }

    /**
     * @param {string} base64
     * @return {SerialBuffer}
     */
    static fromBase64Url(base64) {
        return new SerialBuffer(Uint8Array.from(atob(base64.replace(/_/g, '/').replace(/-/g, '+').replace(/\./g, '=')), c => c.charCodeAt(0)));
    }

    /**
     * @param {Uint8Array} buf
     * @param {string} [alphabet] Alphabet to use
     * @return {string}
     */
    static toBase32(buf, alphabet = BufferUtils.BASE32_ALPHABET.NIMIQ) {
        let shift = 3, carry = 0, byte, symbol, i, res = '';

        for (i = 0; i < buf.length; i++) {
            byte = buf[i];
            symbol = carry | (byte >> shift);
            res += alphabet[symbol & 0x1f];

            if (shift > 5) {
                shift -= 5;
                symbol = byte >> shift;
                res += alphabet[symbol & 0x1f];
            }

            shift = 5 - shift;
            carry = byte << shift;
            shift = 8 - shift;
        }

        if (shift !== 3) {
            res += alphabet[carry & 0x1f];
        }

        while (res.length % 8 !== 0 && alphabet.length === 33) {
            res += alphabet[32];
        }

        return res;
    }

    /**
     * @param {string} base32
     * @param {string} [alphabet] Alphabet to use
     * @return {Uint8Array}
     */
    static fromBase32(base32, alphabet = BufferUtils.BASE32_ALPHABET.NIMIQ) {
        const charmap = [];
        alphabet.toUpperCase().split('').forEach((c, i) => {
            if (!(c in charmap)) charmap[c] = i;
        });

        let symbol, shift = 8, carry = 0, buf = [];
        base32.toUpperCase().split('').forEach((char) => {
            // ignore padding
            if (alphabet.length === 33 && char === alphabet[32]) return;

            symbol = charmap[char] & 0xff;

            shift -= 5;
            if (shift > 0) {
                carry |= symbol << shift;
            } else if (shift < 0) {
                buf.push(carry | (symbol >> -shift));
                shift += 8;
                carry = (symbol << shift) & 0xff;
            } else {
                buf.push(carry | symbol);
                shift = 8;
                carry = 0;
            }
        });

        if (shift !== 8 && carry !== 0) {
            buf.push(carry);
        }

        return new Uint8Array(buf);
    }

    /**
     * @param {*} buffer
     * @return {string}
     */
    static toHex(buffer) {
        let hex = '';
        for (let i = 0; i < buffer.length; i++) {
            const code = buffer[i];
            hex += BufferUtils.HEX_ALPHABET[code >>> 4];
            hex += BufferUtils.HEX_ALPHABET[code & 0x0F];
        }
        return hex;
    }

    /**
     * @param {string} hex
     * @return {SerialBuffer}
     */
    static fromHex(hex) {
        hex = hex.trim();
        if (!StringUtils.isHexBytes(hex)) return null;
        return new SerialBuffer(Uint8Array.from(hex.match(/.{2}/g) || [], byte => parseInt(byte, 16)));
    }

    /**
     * @param {*} bytes
     * @return {string}
     */
    static toBinary(buffer) {
        let bin = '';
        for (let i = 0; i < buffer.length; i++) {
            const code = buffer[i];
            bin += StringUtils.lpad(code.toString(2), '0', 8);
        }
        return bin;
    }

    /**
     * @template T
     * @param {T} a
     * @param {*} b
     * @return {T}
     */
    static concatTypedArrays(a, b) {
        const c = new (a.constructor)(a.length + b.length);
        c.set(a, 0);
        c.set(b, a.length);
        return c;
    }

    /**
     * @param {*} a
     * @param {*} b
     * @return {boolean}
     */
    static equals(a, b) {
        if (a.length !== b.length) return false;
        const viewA = new Uint8Array(a);
        const viewB = new Uint8Array(b);
        for (let i = 0; i < a.length; i++) {
            if (viewA[i] !== viewB[i]) return false;
        }
        return true;
    }

    /**
     * @param {*} a
     * @param {*} b
     * @return {number} -1 if a is smaller than b, 1 if a is larger than b, 0 if a equals b.
     */
    static compare(a, b) {
        if (a.length < b.length) return -1;
        if (a.length > b.length) return 1;
        for (let i = 0; i < a.length; i++) {
            if (a[i] < b[i]) return -1;
            if (a[i] > b[i]) return 1;
        }
        return 0;
    }

    /**
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @return {Uint8Array}
     */
    static xor(a, b) {
        const res = new Uint8Array(a.byteLength);
        for (let i = 0; i < a.byteLength; ++i) {
            res[i] = a[i] ^ b[i];
        }
        return res;
    }
}
BufferUtils.BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
BufferUtils.BASE32_ALPHABET = {
    RFC4648: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=',
    RFC4648_HEX: '0123456789ABCDEFGHIJKLMNOPQRSTUV=',
    NIMIQ: '0123456789ABCDEFGHJKLMNPQRSTUVXY'
};
BufferUtils.HEX_ALPHABET = '0123456789abcdef';
BufferUtils._BASE64_LOOKUP = [];
for (let i = 0, len = BufferUtils.BASE64_ALPHABET.length; i < len; ++i) {
    BufferUtils._BASE64_LOOKUP[i] = BufferUtils.BASE64_ALPHABET[i];
}

Class.register(BufferUtils);
