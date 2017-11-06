class CryptoLib {
    /**
     * @return {SubtleCrypto|*}
     */
    static get instance() {
        if (!CryptoLib._instance) {
            CryptoLib._instance = CryptoLib._init_instance();
        }
        return CryptoLib._instance;
    }

    static _init_instance() {
        const instance = {
            _nimiq_callDigestDelayedWhenMining: false
        };

        instance.getRandomValues = window.crypto.getRandomValues.bind(window.crypto);

        // We can use Webkit's SHA-256 // TODO not required anymore
        const subtle = typeof window !== 'undefined' ? (window.crypto.subtle) : (self.crypto.subtle);
        const wk = typeof window !== 'undefined' ? (window.crypto.webkitSubtle) : (self.crypto.webkitSubtle);
        if (subtle) {
            instance.digest = subtle.digest.bind(subtle);
        } else if (wk) {
            instance._nimiq_callDigestDelayedWhenMining = true;
            instance.digest = (alg, arr) => wk.digest(alg, arr);
        } else {
            instance._nimiq_callDigestDelayedWhenMining = true;
            if (!('require' in window)) throw 'Sha256 fallback not available.';
            const sha256 = window.require('fast-sha256');
            instance.digest = async (alg, arr) => {
                if (alg !== 'SHA-256') throw 'Unsupported algorithm.';
                return new sha256.Hash().update(arr).digest();
            };
        }

        return instance;
    }
}
CryptoLib._instance = null;
Class.register(CryptoLib);
