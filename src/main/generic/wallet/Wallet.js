// TODO V2: Store private key encrypted
class Wallet {
    static async getPersistent() {
        const db = new WalletStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = await KeyPair.generate();
            await db.put('keys', keys);
        }
        return new Wallet(keys);
    }

    static async createVolatile() {
        return new Wallet(await KeyPair.generate());
    }

    constructor(keyPair) {
        this._keyPair = keyPair;
        return this._init();
    }

    async _init() {
        this._address = await this._keyPair.publicKey.toAddress();
        return this;
    }

    createTransaction(recipientAddr, value, fee, nonce) {
        const transaction = new Transaction(this._keyPair.publicKey, recipientAddr, value, fee, nonce);
        return this._signTransaction(transaction);
    }

    async _signTransaction(transaction) {
        transaction.signature = await Signature.create(this._keyPair.privateKey, transaction.serializeContent());
        return transaction;
    }

    get address() {
        return this._address;
    }

    get publicKey() {
        return this._keyPair.publicKey;
    }

    get keyPair() {
        return this._keyPair;
    }
}
Class.register(Wallet);
