class WalletStore extends TypedDB {
    constructor() {
        super('wallet', KeyPair);
    }

    async get(key) {
        return this.getObject(key);
    }

    async put(key, value) {
        return this.putObject(key, value);
    }
}
Class.register(WalletStore);
