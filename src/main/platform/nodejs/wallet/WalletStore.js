const WebCrypto = require('node-webcrypto-ossl');
const webcrypto = new WebCrypto({
    directory: 'database/keys'
});

class WalletStore {
    constructor() {
        this._keyStorage = webcrypto.keyStorage;
    }

    put(key, value) {
        this._keyStorage.setItem(`${key}_pub`, value.publicKey);
        this._keyStorage.setItem(`${key}_priv`, value.privateKey);
    }

    get(key) {
        const pubKey = this._keyStorage.getItem(`${key}_pub`);
        const privKey = this._keyStorage.getItem(`${key}_priv`);
        if (!pubKey || !privKey) return undefined;
        return {
            publicKey: pubKey,
            privateKey: privKey
        };
    }
}
Class.register(WalletStore);
