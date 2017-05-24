// TODO V2: Store private key encrypted
class Wallet {

	static async getPersistent(accounts, mempool) {
		const db = new WalletStore();
		let keys = await db.get('keys');
		if (!keys) {
			keys = await Crypto.generateKeys();
			await db.put('keys', keys);
		}
		return await new Wallet(keys, accounts, mempool);
	}

	static async createVolatile(accounts, mempool) {
		const keys = await Crypto.generateKeys();
		return await new Wallet(keys, accounts, mempool);
	}

	constructor(keys, accounts, mempool) {
		this._keys = keys;
		this._accounts = accounts;
		this._mempool = mempool;
		return this._init();
	}

	async _init() {
		this._publicKey = await Crypto.exportPublic(this._keys.publicKey);
		this._address = await Crypto.exportAddress(this._keys.publicKey);
		return this;
	}

	importPrivate(privateKey) {
		return Crypto.importPrivate(privateKey)
	}

	exportPrivate() {
		return Crypto.exportPrivate(this._keys.privateKey);
	}

	createTransaction(recipientAddr, value, fee, nonce) {
		const transaction = new Transaction(this._publicKey, recipientAddr, value, fee, nonce);
		return this._signTransaction(transaction);
	}

	async _signTransaction(transaction) {
		return Crypto.sign(this._keys.privateKey, transaction.serializeContent())
			.then(signature => {
				transaction.signature = signature;
				return transaction;
			});
	}

	async transferFunds(recipientAddr, value, fee){
		await this.getBalance()
				.then(balance => this.createTransaction(recipientAddr, value, fee, balance.nonce)
				.then(transaction => this._mempool.pushTransaction(transaction)));
	}

	get address() {
		return this._address;
	}

	get publicKey() {
		return this._publicKey;
	}

	async getBalance(accounts){
		return this._accounts.getBalance(this.address);
	}
}
Class.register(Wallet);
