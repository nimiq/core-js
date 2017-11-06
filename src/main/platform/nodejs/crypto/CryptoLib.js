const WebCrypto = require('node-webcrypto-ossl');
global.webcrypto = new WebCrypto({
    directory: 'database/keys'
});
global.ED25519 = require('ed25519');
global.ED25519.setPath('ed25519/dist/', 'node_modules/ed25519/dist/');

class CryptoLib {
    static get instance() {
        if (!CryptoLib._instance) {
            const instance = {};
            const subtle = global.webcrypto.subtle;
            instance.digest = subtle.digest.bind(subtle);
            instance.getRandomValues = global.webcrypto.getRandomValues.bind(global.webcrypto);

            instance.sign = global.ED25519.sign.bind(global.ED25519);
            instance.verify = global.ED25519.verify.bind(global.ED25519);
            instance.derivePublicKey = global.ED25519.derivePublicKey.bind(global.ED25519);
            CryptoLib._instance = instance;
        }
        return CryptoLib._instance;
    }
}
CryptoLib._instance = null;
Class.register(CryptoLib);
