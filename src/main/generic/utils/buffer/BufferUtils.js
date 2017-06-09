class BufferUtils {
    static toAscii(buffer) {
        return String.fromCharCode.apply(null, new Uint8Array(buffer));
    }

    static fromAscii(string) {
        var buf = new Uint8Array(string.length);
        for (let i = 0; i < string.length; ++i) {
            buf[i] = string.charCodeAt(i);
        }
        return buf;
    }

    static toBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    static fromBase64(base64) {
        return new SerialBuffer(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
    }

    static toBase64Url(buffer) {
        return BufferUtils.toBase64(buffer).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '.');
    }

    static fromBase64Url(base64) {
        return new SerialBuffer(Uint8Array.from(atob(base64.replace(/_/g, '/').replace(/-/g, '+').replace(/\./g, '=')), c => c.charCodeAt(0)));
    }

    static toHex(buffer) {
        return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
    }

    static fromHex(hex) {
        if (hex.length % 2 !== 0) return null;
        return new SerialBuffer(Uint8Array.from(hex.match(/.{2}/g), byte => parseInt(byte, 16)));
    }

    static concatTypedArrays(a, b) {
        const c = new (a.constructor)(a.length + b.length);
        c.set(a, 0);
        c.set(b, a.length);
        return c;
    }

    static equals(a, b) {
        if (a.length !== b.length) return false;
        const viewA = new Uint8Array(a);
        const viewB = new Uint8Array(b);
        for (let i = 0; i < a.length; i++) {
            if (viewA[i] !== viewB[i]) return false;
        }
        return true;
    }
}
Class.register(BufferUtils);
