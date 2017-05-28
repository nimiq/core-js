class Crypto {
    static get lib() { return CryptoLib.instance; }

    static get settings() {
        const hashAlgo = {name: 'SHA-256'};
        const signAlgo = 'ECDSA';
        const curve = 'P-256';    // can be 'P-256', 'P-384', or 'P-521'
        return {
            hashAlgo: hashAlgo,
            curve: curve,
            keys: {name: signAlgo, namedCurve: curve},
            sign: {name: signAlgo, hash: hashAlgo}
        };
    }

    static sha256(buffer) {
        return Crypto.lib.digest(Crypto.settings.hashAlgo, buffer)
            .then(hash => new Hash(hash));
    }

    static generateKeys() {
        return Crypto.lib.generateKey(Crypto.settings.keys, true, ['sign', 'verify']);
    }

    static async exportPair(pair) {
        if (!pair) return pair;
        return {
            publicKey: await Crypto.exportPublic(pair.publicKey),
            privateKey: await Crypto.exportPrivate(pair.privateKey)
        };
    }

    static async importPair(pair) {
        if (!pair) return pair;
        if (!(pair.privateKey instanceof Object)) return pair; // It's already imported
        return {
            publicKey: await Crypto.importPublic(pair.publicKey),
            privateKey: await Crypto.importPrivate(pair.privateKey)
        };
    }

    static exportPrivate(privateKey) {
        return Crypto.lib.exportKey('jwk', privateKey);
    }

    static importPrivate(privateKey) {
        return Crypto.lib.importKey('jwk', privateKey, Crypto.settings.keys, true, ['sign']);
    }

    static exportPublic(publicKey, format = 'raw') {
        return Crypto.lib.exportKey(format, publicKey)
            .then(key => new PublicKey(key));
    }

    static exportAddress(publicKey) {
        return Crypto.exportPublic(publicKey).then(Crypto.publicToAddress);
    }

    static importPublic(publicKey, format = 'raw') {
        return Crypto.lib.importKey(format, publicKey, Crypto.settings.keys, true, ['verify']);
    }

    static publicToAddress(publicKey) {
        return Crypto.sha256(publicKey).then(hash => hash.subarray(0, 20))
            .then(address => new Address(address));
    }

    static sign(privateKey, data) {
        return Crypto.lib.sign(Crypto.settings.sign, privateKey, data)
            .then(sign => new Signature(sign));
    }

    static verify(publicKey, signature, data) {
        return Crypto.importPublic(publicKey)
            .then(key => Crypto.lib.verify(Crypto.settings.sign, key, signature, data));
    }
}
Class.register(Crypto);
