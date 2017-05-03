var WebCrypto = require("node-webcrypto-ossl");
var webcrypto = new WebCrypto({
    directory: "database/keys"
});

class WalletStore{
	constructor(){
		this._keyStorage = webcrypto.keyStorage;
	}

	put(key, value){
		return Promise.resolve(this._keyStorage.put(key,value));
	}

	get(key){
		return Promise.resolve(this._keyStorage.get(key));
	}
}