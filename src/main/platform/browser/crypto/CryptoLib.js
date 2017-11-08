class CryptoLib {
    /**
     * @return {SubtleCrypto|*}
     */
    static get instance() {
        if (!CryptoLib._instance) {
            const instance = {};
            instance.getRandomValues = (window.crypto || window.msCrypto).getRandomValues.bind(window.crypto);

            CryptoLib._instance = instance;
        }
        return CryptoLib._instance;
    }
}
CryptoLib._instance = null;
Class.register(CryptoLib);
