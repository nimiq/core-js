class CryptoLib {
    static get instance() {
        if (!CryptoLib._poly_instance) {
            CryptoLib._poly_instance = CryptoLib._init_poly();
        }
        return CryptoLib._poly_instance;
    }

    static _init_poly() {
        const poly = {};

        // We can use Webkit's SHA-256
        let subtle = typeof window !== 'undefined' ? (window.crypto.subtle) : (self.crypto.subtle);
        let wk = typeof window !== 'undefined' ? (window.crypto.webkitSubtle) : (self.crypto.webkitSubtle);
        if (poly.digest) {
            // Keep original
        } else if (subtle) {
            poly.digest = subtle.digest.bind(subtle);
        } else if (wk) {
            poly._nimiq_callDigestDelayedWhenMining = true;
            poly.digest = (alg, arr) => wk.digest(alg, arr);
        } else {
            poly._nimiq_callDigestDelayedWhenMining = true;
            const sha256 = require('fast-sha256');
            poly.digest = async (alg, arr) => {
                if (alg !== 'SHA-256') throw 'Unsupported algorithm.';
                return new sha256.Hash().update(arr).digest();
            };
        }

        if (subtle) {
            poly.sign = subtle.sign.bind(subtle);
            poly.verify = subtle.verify.bind(subtle);
            poly.exportKey = subtle.exportKey.bind(subtle);
            poly.generateKey = async (config, exportable, usage) => {
                try {
                    const res = await subtle.generateKey(config, exportable, usage);
                    // Shortcut
                    poly.generateKey = subtle.generateKey.bind(subtle);
                    poly.importKey = subtle.importKey.bind(subtle);
                    return res;
                } catch (e) {
                    CryptoLib._use_elliptic(poly);
                    return poly.generateKey(config, exportable, usage);
                }
            };
            poly.importKey = async (type, key, config, exportable, usage) => {
                try {
                    const res = await subtle.importKey(type, key, config, exportable, usage);
                    // Shortcut
                    poly.generateKey = subtle.generateKey.bind(subtle);
                    poly.importKey = subtle.importKey.bind(subtle);
                    return res;
                } catch (e) {
                    try {
                        await subtle.generateKey(config, exportable, usage);
                        // Shortcut
                        poly.generateKey = subtle.generateKey.bind(subtle);
                        poly.importKey = subtle.importKey.bind(subtle);
                    } catch (e) {
                        CryptoLib._use_elliptic(poly);
                        return poly.importKey(type, key, config, exportable, usage);
                    }
                    throw e;
                }
            };
        } else {
            CryptoLib._use_elliptic(poly);
        }

        return poly;
    }

    static _use_elliptic(poly) {
        poly._nimiq_isSlowCurves = true;

        const ec = require('elliptic').ec('p256');

        poly.generateKey = function (config, exportable, usage) {
            const keyPair = ec.genKeyPair();
            return {privateKey: {type: 'private', pair: keyPair}, publicKey: {type: 'public', pair: keyPair}};
        };

        const fromDER = function (der) {
            let res = [];
            let start = 4;
            for (let i = 0; i < 2; ++i) {
                let len = der[start - 1];
                for (let j = 0; j < Math.max(32 - len, 0); ++j) res.push(0);
                if (len === 33) {
                    res = res.concat(Array.prototype.slice.call(der, start + 1, start + len));
                } else {
                    res = res.concat(Array.prototype.slice.call(der, start, start + len));
                }
                start = start + len + 2;
            }

            return new Uint8Array(res);
        };

        const toDER = function (arr) {
            let res = [48, 0];
            for (let i = 0; i < 2; ++i) {
                res.push(2);
                if ((arr[0] & 0x80) === 0x80) {
                    res.push(33);
                    res.push(0);
                    res = res.concat(Array.prototype.slice.call(arr, (i * 32), (i * 32) + 32));
                } else {
                    let len = 32;
                    while (res[((i + 1) * 32) - len] === 0 && (res[((i + 1) * 32) - len + 1] & 0x80) === 0x80) len--;
                    res.push(len);
                    res = res.concat(Array.prototype.slice.call(arr, ((i + 1) * 32) - len, (i * 32) + 32));
                }
            }
            res[1] = res.length - 2;
            return res;
        };

        poly.sign = async function (config, privateKey, data) {
            const digest = await poly.digest(config.hash, data);
            const msgHash = new Uint8Array(digest);
            return fromDER(privateKey.pair.sign(msgHash).toDER());
        };

        poly.verify = async function (config, publicKey, signature, data) {
            const digest = await poly.digest(config.hash, data);
            const msgHash = new Uint8Array(digest);
            return publicKey.pair.verify(msgHash, {r: signature.slice(0, 32), s: signature.slice(32, 64)});
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
