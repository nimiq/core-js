const WebCrypto = require("node-webcrypto-ossl");
global.webcrypto = new WebCrypto({
    directory: "database/keys"
});

class CryptoLib {
    static get instance() {
        return global.webcrypto.subtle;
    }
}
Class.register(CryptoLib);
