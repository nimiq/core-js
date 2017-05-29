class WalletStore extends TypedDB {
    constructor() {
        super('wallet');
    }

    async get(key) {
        return Crypto.importPair(await TypedDB.prototype.getObject.call(this, key));
    }

    async put(key, value) {
        return TypedDB.prototype.putObject.call(this, key, await Crypto.exportPair(value));
    }
}
