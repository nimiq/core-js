class Crypto {
    static get lib() { return CryptoLib.instance; }

    // Signature implementation using ED25519 through WebAssembly
    static get publicKeySize() {
        return 32;
    }

    static get publicKeyType() {
        return Uint8Array;
    }

    static publicKeySerialize(key) {
        // key is already a Uint8Array
        return key;
    }

    static publicKeyUnserialize(key) {
        return key;
    }

    static async publicKeyDerive(privateKey) {
        const publicKey = new Uint8Array(Crypto.publicKeySize);
        await Crypto.lib.derivePublicKey(publicKey, privateKey);
        return publicKey;
    }

    static get privateKeySize() {
        return 32;
    }

    static get privateKeyType() {
        return Uint8Array;
    }

    static privateKeySerialize(key) {
        // already a Uint8Array
        return key;
    }

    static privateKeyUnserialize(key) {
        return key;
    }

    static privateKeyGenerate() {
        const privateKey = new Uint8Array(Crypto.privateKeySize);
        Crypto.lib.getRandomValues(privateKey);
        return privateKey;
    }

    static get keyPairType() {
        return Object;
    }

    static async keyPairGenerate() {
        return Crypto.keyPairDerive(Crypto.privateKeyGenerate());
    }

    static async keyPairDerive(privateKey) {
        return {
            privateKey,
            publicKey: await Crypto.publicKeyDerive(privateKey)
        };
    }

    static keyPairPrivate(obj) {
        return obj.privateKey;
    }

    static keyPairPublic(obj) {
        return obj.publicKey;
    }

    static keyPairFromKeys(privateKey, publicKey) {
        return { privateKey, publicKey };
    }

    static async signatureCreate(privateKey, publicKey, data) {
        const signature = new Uint8Array(Crypto.signatureSize);
        await Crypto.lib.sign(signature, data, publicKey, privateKey);
        return signature;
    }

    static async signatureVerify(publicKey, data, signature) {
        return await Crypto.lib.verify(signature, data, publicKey);
    }

    static signatureSerialize(obj) {
        return obj;
    }

    static signatureUnserialize(arr) {
        return arr;
    }

    static get signatureSize() {
        return 64;
    }

    static get signatureType() {
        return Uint8Array;
    }

    // Light hash implementation using SHA-256 with WebCrypto API and fast-sha256 fallback
    //
    // static get sha256() { return require('fast-sha256'); }
    //
    // static async hashLight(arr) {
    //     if (Crypto.lib) {
    //         return new Uint8Array(await Crypto.lib.digest('SHA-256', arr));
    //     } else {
    //         return new Promise((res) => {
    //             // Performs badly, but better than a dead UI
    //             setTimeout(() => {
    //                 res(new Crypto.sha256.Hash().update(arr).digest());
    //             });
    //         });
    //     }
    // }

    // Light hash implementation using SHA-256 with WebCrypto API
    static async hashLight(arr) {
        return new Uint8Array(await Crypto.lib.digest('SHA-256', arr));
    }

    // Hard hash implementation using double light hash
    //static async hashHard(arr) {
    //    return Crypto.hashLight(await Crypto.hashLight(arr));
    //}

    // Hard hash implementation using light hash
    static async hashHard(arr) {
        if (Crypto.lib._nimiq_callDigestDelayedWhenMining) {
            return await new Promise((resolve, error) => {
                window.setTimeout(() => {
                    Crypto.hashLight(arr).then(resolve);
                });
            });
        } else {
            return Crypto.hashLight(arr);
        }
    }

    static get hashSize() {
        return 32;
    }

    static get hashType() {
        return Uint8Array;
    }
}
Class.register(Crypto);
