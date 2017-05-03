class WalletStore extends TypedDB {
	constructor(){
		super('wallet');
	}

	get(key) {
		return super.getObject(key);
	}

	put(key, value) {
		return super.putObject(key, value);
	}
}
