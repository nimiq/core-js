class Crypto {
    static get lib() { return CryptoLib.instance; }

    // Signature implementation using Ed25519 via tweetnacl
    // tweetnacl is rather slow, so not using this for now
    //
    // static get curve() { return require('tweetnacl'); }
    //
    // static get publicKeySize() {
    //     return Crypto.curve.sign.publicKeyLength;
    // }
    //
    // static get publicKeyType() {
    //     return Uint8Array;
    // }
    //
    // static publicKeySerialize(obj) {
    //     return obj;
    // }
    //
    // static publicKeyUnserialize(arr) {
    //     return arr;
    // }
    //
    // static publicKeyDerive(privateKey) {
    //     return Crypto.keyPairPublic(Crypto.keyPairDerive(privateKey));
    // }
    //
    // static get privateKeySize() {
    //     return Crypto.curve.sign.secretKeyLength;
    // }
    //
    // static get privateKeyType() {
    //     return Uint8Array;
    // }
    //
    // static privateKeySerialize(obj) {
    //     return obj;
    // }
    //
    // static privateKeyUnserialize(arr) {
    //     return arr;
    // }
    //
    // static privateKeyGenerate() {
    //     return Crypto.keyPairPrivate(Crypto.keyPairGenerate());
    // }
    //
    // static get keyPairType() {
    //     return Object;
    // }
    //
    // static keyPairGenerate() {
    //     return Crypto.curve.sign.keyPair();
    // }
    //
    // static keyPairDerive(privateKey) {
    //     return Crypto.curve.sign.keyPair.fromSecretKey(privateKey);
    // }
    //
    // static keyPairPrivate(obj) {
    //     return obj.secretKey;
    // }
    //
    // static keyPairPublic(obj) {
    //     return obj.publicKey;
    // }
    //
    // static signatureCreate(privateKey, data) {
    //     return Crypto.curve.sign.detached(data, privateKey);
    // }
    //
    // static signatureVerify(publicKey, data, signature) {
    //     return Crypto.curve.sign.detached.verify(data, signature, publicKey);
    // }
    //
    // static signatureSerialize(obj) {
    //     return obj;
    // }
    //
    // static signatureUnserialize(arr) {
    //     return arr;
    // }
    //
    // static get signatureSize() {
    //     return Crypto.curve.sign.signatureLength;
    // }
    //
    // static get signatureType() {
    //     return Uint8Array;
    // }

    // Signature implementation using P-256/SHA-256 with WebCrypto API
    static get _keyConfig() {
        return {name: 'ECDSA', namedCurve: 'P-256'};
    }

    static get _signConfig() {
        return {name: 'ECDSA', hash: 'SHA-256'};
    }

    static get publicKeySize() {
        return 64;
    }

    static get publicKeyType() {
        return Object;
    }

    static publicKeySerialize(obj) {
        if (obj.raw.length === 64) {
            return obj.raw;
        }  else {
            return obj.raw.slice(1);
        }
    }

    static publicKeyUnserialize(arr) {
        return {raw: arr};
    }

    static async _publicKeyNative(obj) {
        if (!obj._native) {
            let arr;
            if (obj.raw.length === 64) {
                arr = new Uint8Array(65);
                arr[0] = 4;
                arr.set(obj.raw, 1);
            } else {
                arr = obj.raw;
            }
            obj._native = await Crypto.lib.importKey('raw', arr, Crypto._keyConfig, true, ['verify']);
        }
        return obj._native;
    }

    static async publicKeyDerive(privateKey) {
        return Crypto.keyPairPublic(await Crypto.keyPairDerive(privateKey));
    }

    static get privateKeySize() {
        return 96;
    }

    static get privateKeyType() {
        return Object;
    }

    static _jwk_serialize(jwk) {
        const fromUri64 = function (u64) {
            return Array.from(atob(u64.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
        };
        return new Uint8Array(fromUri64(jwk.d).concat(fromUri64(jwk.x)).concat(fromUri64(jwk.y)));
    }

    static _jwk_unserialize(arr) {
        const toUri64 = function (arr) {
            return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        };

        return {
            crv: 'P-256',
            d: toUri64(Array.prototype.slice.call(arr, 0, 32)),
            ext: true,
            key_ops: ['sign'],
            kty: 'EC',
            x: toUri64(Array.prototype.slice.call(arr, 32, 64)),
            y: toUri64(Array.prototype.slice.call(arr, 64)),
        };
    }

    static privateKeySerialize(obj) {
        return Crypto._jwk_serialize(obj.jwk);
    }

    static privateKeyUnserialize(arr) {
        return {jwk: Crypto._jwk_unserialize(arr)};
    }

    static async _privateKeyNative(obj) {
        if (!obj._native) {
            obj._native = await Crypto.lib.importKey('jwk', obj.jwk, Crypto._keyConfig, true, ['sign']);
        }
        return obj._native;
    }

    static async privateKeyGenerate() {
        return Crypto.keyPairPrivate(await Crypto.keyPairGenerate());
    }

    static get keyPairType() {
        return Object;
    }

    static async keyPairGenerate() {
        let key = await Crypto.lib.generateKey(Crypto._keyConfig, true, ['sign', 'verify']);
        return {
            secretKey: {
                _native: key.privateKey,
                jwk: await Crypto.lib.exportKey('jwk', key.privateKey)
            },
            publicKey: {
                _native: key.publicKey,
                raw: new Uint8Array(await Crypto.lib.exportKey('raw', key.publicKey)).subarray(1)
            }
        };
    }

    static keyPairDerive(privateKey) {
        return {
            secretKey: privateKey,
            publicKey: Crypto.publicKeyUnserialize(new Uint8Array(Array.prototype.slice.call(Crypto.privateKeySerialize(privateKey), 32)))
        };
    }

    static keyPairPrivate(obj) {
        return obj.secretKey;
    }

    static keyPairPublic(obj) {
        return obj.publicKey;
    }

    static async signatureCreate(privateKey, data) {
        return new Uint8Array(await Crypto.lib.sign(Crypto._signConfig, await Crypto._privateKeyNative(privateKey), data));
    }

    static async signatureVerify(publicKey, data, signature) {
        return Crypto.lib.verify(Crypto._signConfig, await Crypto._publicKeyNative(publicKey), signature, data);
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
