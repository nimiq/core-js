class CryptoLib {
    static get instance() {
        return typeof window !== 'undefined' ?
            window.crypto.subtle : self.crypto.subtle;
    }
}
