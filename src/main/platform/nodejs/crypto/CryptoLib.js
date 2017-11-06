const WebCrypto = require('node-webcrypto-ossl');
global.webcrypto = new WebCrypto({ // TODO not required anymore
    directory: 'database/keys'
});

class CryptoLib {
    static get instance() {
        if (!CryptoLib._instance) {
            const instance = {};
            const subtle = global.webcrypto.subtle;
            instance.digest = subtle.digest.bind(subtle);
            instance.getRandomValues = global.webcrypto.getRandomValues.bind(global.webcrypto);

            CryptoLib._instance = instance;
        }
        return CryptoLib._instance;
    }
}
CryptoLib._instance = null;
Class.register(CryptoLib);
