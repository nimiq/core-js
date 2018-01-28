// TODO: Move outside of Nimiq Core library?
class WalletStore {
    /**
     * @returns {Promise.<WalletStore>}
     */
    constructor() {
        this._jdb = new JDB.JungleDB('wallet', WalletStore.VERSION);
        /** @type {ObjectStore} */
        this._walletStore = null;
        /** @type {ObjectStore} */
        this._multisigStore = null;

        return this._init();
    }

    /**
     * @returns {Promise.<WalletStore>}
     */
    async _init() {
        // Initialize object stores.
        this._walletStore = this._jdb.createObjectStore(WalletStore.WALLET_DATABASE, new WalletStoreCodec());
        this._multisigStore = this._jdb.createObjectStore(WalletStore.MULTISIG_WALLET_DATABASE, new WalletStoreCodec());

        // Establish connection to database.
        await this._jdb.connect();

        return this;
    }

    /**
     * @param {Uint8Array|string} [key]
     * @returns {Promise.<?Wallet>}
     */
    async getMainWallet(key) {
        const mainAddress = await this._walletStore.get('main');
        if (!mainAddress) return null;
        const base64Address = BufferUtils.toBase64(mainAddress);

        const buf = await this._walletStore.get(base64Address);
        if (key) {
            return Wallet.loadEncrypted(buf, key);
        }
        return Wallet.load(buf);
    }

    /**
     * @param {Address} address
     * @returns {Promise}
     */
    setMainWallet(address) {
        const mainAddress = address.serialize();
        return this._walletStore.put('main', mainAddress);
    }

    /**
     * @param {Address} address
     * @param {Uint8Array|string} [key]
     * @returns {Promise.<Wallet>}
     */
    async getWallet(address, key) {
        const base64Address = address.toBase64();
        const buf = await this._walletStore.get(base64Address);
        if (key) {
            return Wallet.loadEncrypted(buf, key);
        }
        return Wallet.load(buf);
    }

    /**
     * @param {Wallet} wallet
     * @param {Uint8Array|string} [key]
     * @returns {Promise}
     */
    putWallet(wallet, key) {
        const base64Address = wallet.address.toBase64();
        let buf = null;
        if (key) {
            buf = wallet.exportEncrypted(key);
        } else {
            buf = wallet.exportPlain();
        }
        return this._walletStore.put(base64Address, buf);
    }

    /**
     * @param {Address} address
     * @param {Uint8Array|string} [key]
     * @returns {Promise.<MultiSigWallet>}
     */
    async getMultiSigWallet(address, key) {
        const base64Address = address.toBase64();
        const buf = await this._multisigStore.get(base64Address);
        if (key) {
            return MultiSigWallet.loadEncrypted(buf, key);
        }
        return MultiSigWallet.load(buf);
    }

    /**
     * @param {MultiSigWallet} wallet
     * @param {Uint8Array|string} [key]
     * @returns {Promise}
     */
    putMultiSigWallet(wallet, key) {
        const base64Address = wallet.address.toBase64();
        let buf = null;
        if (key) {
            buf = wallet.exportEncrypted(key);
        } else {
            buf = wallet.exportPlain();
        }
        return this._multisigStore.put(base64Address, buf);
    }

    close() {
        return this._jdb.close();
    }
}
Class.register(WalletStore);
WalletStore._instance = null;
WalletStore.VERSION = 1;
WalletStore.WALLET_DATABASE = 'wallets';
WalletStore.MULTISIG_WALLET_DATABASE = 'multisig-wallets';

/**
 * @implements {ICodec}
 */
class WalletStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return obj;
    }

    /**
     * @param {*} buf The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(buf, key) {
        return new Uint8Array(buf);
    }

    /**
     * @type {string}
     */
    get valueEncoding() {
        return 'binary';
    }
}
