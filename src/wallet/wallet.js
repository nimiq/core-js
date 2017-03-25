// TODO V2: Store private key encrypted
class Wallet{

	static get(accounts){
		const db = new RawIndexedDB('wallet');
		return db.get('keys').then(value => {
			if(value) return new Wallet(accounts,value);
			return Crypto.generateKeys()
				.then(keys => db.put('keys',keys)
					.then( _ => new Wallet(accounts,keys)));
		});
	}
	
	constructor(accounts, keys){
		this._accounts = accounts;
		this.keys = keys;
	}

	importPrivate(privateKey){
		return Crypto.importPrivate(privateKey)
	}

	exportPrivate(){
		return Crypto.exportPrivate(this.keys.privateKey)
			.then( buffer => Buffer.toHex(buffer));
	}

	exportPublic(){
		return Crypto.exportPublic(this.keys.publicKey);
	}

	exportAddress(){
		return Crypto.exportAddress(this.keys.publicKey);
	}

	_signTx(rawTx, publicKey){
		return Crypto.sign(this.keys.privateKey, rawTx)
			.then(signature => Transaction.create(rawTx, publicKey, signature));
	}

	_getAccount(){
		return this.exportAddress()
			.then(addr => this._accounts.fetch(addr));
	}

	createTx(value, receiverAddr, fee){
		return this.exportPublic()
			.then(publicKey => this._getAccount()
				.then(acc => {
					if( acc.value < value + fee ) throw 'Insufficient funds';
					const rawTx = new RawTx(value, Buffer.fromBase64(receiverAddr), fee, acc.nonce);
					return this._signTx(rawTx, publicKey);
				}));
	}
}

