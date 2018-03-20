class CryptoLib {
    static get instance() {
        if (!CryptoLib._instance) {
            const instance = {};
            const crypto = require('crypto');
            instance.getRandomValues = (buf) => {
                if (!(buf instanceof Uint8Array)) {
                    throw new TypeError('expected Uint8Array');
                }
                if (buf.length > 65536) {
                    const e = new Error();
                    e.code = 22;
                    e.message = `Failed to execute 'getRandomValues' on 'Crypto': The ArrayBufferView's byte length ${buf.length} exceeds the number of bytes of entropy available via this API (65536).`;
                    e.name = 'QuotaExceededError';
                    throw e;
                }
                const bytes = crypto.randomBytes(buf.length);
                buf.set(bytes);
                return buf;
            };

            CryptoLib._instance = instance;
        }
        return CryptoLib._instance;
    }
}

CryptoLib._instance = null;
Class.register(CryptoLib);
