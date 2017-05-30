// TODO V2: Store private key encrypted
class Wallet {
    static async getPersistent() {
        const db = new WalletStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = await Crypto.generateKeys();
            await db.put('keys', keys);
        }
        return new Wallet(keys);
    }

    static async createVolatile() {
        const keys = await Crypto.generateKeys();
        return new Wallet(keys);
    }

    constructor(keys) {
        this._keys = keys;
        return this._init();
    }

    async _init() {
        this._publicKey = await Crypto.exportPublic(this._keys.publicKey);
        this._address = await Crypto.exportAddress(this._keys.publicKey);
        return this;
    }

    importPrivate(privateKey) {
        return Crypto.importPrivate(privateKey);
    }

    exportPrivate() {
        return Crypto.exportPrivate(this._keys.privateKey);
    }

    createTransaction(recipientAddr, value, fee, nonce) {
        const transaction = new Transaction(this._publicKey, recipientAddr, value, fee, nonce);
        return this._signTransaction(transaction);
    }

    _signTransaction(transaction) {
        return Crypto.sign(this._keys.privateKey, transaction.serializeContent())
            .then(signature => {
                transaction.signature = signature;
                return transaction;
            });
    }

    get address() {
        return this._address;
    }

    get publicKey() {
        return this._publicKey;
    }
}
Class.register(Wallet);
