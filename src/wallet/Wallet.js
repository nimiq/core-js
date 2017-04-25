// TODO V2: Store private key encrypted
class Wallet{

	static get(){
		const db = new RawIndexedDB('wallet');
		return db.get('keys').then(keys => {
			if(keys) return new Wallet(keys);
			return Crypto.generateKeys()
				.then(keys => db.put('keys',keys)
					.then( _ => new Wallet(keys)));
		});
	}
	
	constructor(keys){
		this._keys = keys;
	}

	importPrivate(privateKey){
		return Crypto.importPrivate(privateKey)
	}

	exportPrivate(){
		return Crypto.exportPrivate(this._keys.privateKey)
			.then( buffer => Buffer.toHex(buffer));
	}

	exportPublic(){
		return Crypto.exportPublic(this._keys.publicKey);
	}

	exportAddress(){
		return Crypto.exportAddress(this._keys.publicKey);
	}

	_signTransaction(rawTransaction){
		return Crypto.sign(this._keys.privateKey, rawTransaction.serialize())
			.then(signature => new Transaction(rawTransaction, signature));
	}

	_getAccount(){
		return this.exportAddress()
			.then(addr => this._accounts.fetch(addr));
	}

	createTransaction(recipientAddr, value, fee, nonce){
		return this.exportPublic()
			.then(publicKey => {
				const rawTransaction = new RawTransaction(publicKey, recipientAddr, value, fee, nonce);
				return this._signTransaction(rawTransaction);
			});
	}
}

