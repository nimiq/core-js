class CryptoLib {
    static get instance() {
        let native = typeof window !== 'undefined' ? (window.crypto.subtle) : (self.crypto.subtle);
        if (native) return native;
        if (!CryptoLib._poly_instance) {
            CryptoLib._poly_instance = CryptoLib._init_poly();
        }
        return CryptoLib._poly_instance;
    }

    static _init_poly() {
        const poly = {};

        // We can use Webkit's SHA-256
        let wk = typeof window !== 'undefined' ? (window.crypto.webkitSubtle) : (self.crypto.webkitSubtle);
        if (wk) {
            poly.digest = wk.digest.bind(wk);
        } else {
            const sha256 = require('fast-sha256');
            poly.digest = function (alg, arr) {
                if (alg !== 'SHA-256') throw 'Unsupported algorithm.';
                return new Promise((res) => {
                    // Performs badly, but better than a dead UI
                    setTimeout(() => {
                        res(new sha256.Hash().update(arr).digest());
                    });
                });
            };
        }

        const ec = require('elliptic').ec('p256');

        poly.generateKey = function (config, exportable, usage) {
            const keyPair = ec.genKeyPair();
            return {privateKey: {type: 'private', pair: keyPair}, publicKey: {type: 'public', pair: keyPair}};
        };

        const fromDER = function (der) {
            let res;
            let ss = 37;
            if (der[3] === 33) {
                ss++;
                res = Array.prototype.slice.call(der, 5, 37);
            } else {
                res = Array.prototype.slice.call(der, 4, 36);
            }
            if (der[ss] === 33) {
                res = res.concat(Array.prototype.slice.call(der, ss + 2, ss + 34));
            } else {
                res = res.concat(Array.prototype.slice.call(der, ss + 1, ss + 33));
            }
            return new Uint8Array(res);
        };

        const toDER = function (arr) {
            let res = [0x30, 0x44];
            if (arr[0] & 0x80) {
                res = res.concat([0x02, 0x21, 0]).concat(Array.prototype.slice.call(arr, 0, 32));
                res[1]++;
            } else {
                res = res.concat([0x02, 0x20]).concat(Array.prototype.slice.call(arr, 0, 32));
            }
            if (arr[32] & 0x80) {
                res = res.concat([0x02, 0x21, 0]).concat(Array.prototype.slice.call(arr, 32));
                res[1]++;
            } else {
                res = res.concat([0x02, 0x20]).concat(Array.prototype.slice.call(arr, 32));
            }
            return res;
        };

        poly.sign = async function (config, privateKey, data) {
            const msgHash = await poly.digest(config.hash, data);
            return fromDER(privateKey.pair.sign(msgHash).toDER());
        };

        poly.verify = async function (config, publicKey, signature, data) {
            const msgHash = await poly.digest(config.hash, data);
            return publicKey.pair.verify(msgHash, toDER(signature));
        };

        const toUri64 = function (arr) {
            return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        };

        const fromUri64 = function (u64) {
            return Uint8Array.from(atob(u64.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
        };

        const toHex = function (arr) {
            return Array.prototype.map.call(arr, x => ('00' + x.toString(16)).slice(-2)).join('');
        };

        poly.exportKey = function (type, key) {
            if (key.type === 'public' && type === 'raw') {
                return key.pair.getPublic().encode();
            } else if (key.type === 'private' && type === 'jwk') {
                let pub = key.pair.getPublic().encode();
                return {
                    crv: 'P-256',
                    d: toUri64(key.pair.getPrivate().toArrayLike(Uint8Array)),
                    ext: true,
                    key_ops: ['sign'],
                    kty: 'EC',
                    x: toUri64(pub.slice(1, 33)),
                    y: toUri64(pub.slice(33)),
                };
            } else {
                throw 'Invalid key or unsupported type.';
            }
        };

        poly.importKey = function (type, key, config, exportable, usage) {
            if (type === 'raw' && key[0] === 4) {
                return {type: 'public', pair: ec.keyFromPublic(key)};
            } else if (type === 'jwk' && key.crv === 'P-256') {
                if (key.d) {
                    let priv = ec.keyFromPrivate(fromUri64(key.d));
                    priv.validate();
                    return {type: 'private', pair: priv};
                }
                if (key.x && key.y) {
                    return {
                        type: 'public',
                        pair: ec.keyFromPublic('04' + toHex(fromUri64(key.x)) + toHex(fromUri64(key.y)), 'hex')
                    };
                }
            }
            throw 'Invalid key or unsupported type.';
        };
        return poly;
    }
}
CryptoLib._poly_instance = null;
Class.register(CryptoLib);
