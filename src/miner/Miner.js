class Miner extends Observable{
	constructor(blockchain){
		super();
		this._blockchain = blockchain;
		this._worker = null;

		blockchain.on('head', b => this._onChainHead(b));
	}

	async _onChainHead(currHeader){
		this._stopWork();
	
		const prevHash = await currHeader.hash();
		const accoutsHash = this._blockchain.getAccountsHash();
		const bodyHash = this._getBodyHash();
		const timestamp = this._getCurrentTimestamp();
		const difficulty = this._getCurrentDifficulty(currHeader);
		const nonce = 0;

		const nextHeader = new BlockHeader(prevHash, accoutsHash, bodyHash, difficulty, timestamp, nonce);

		this._worker = setInterval( () => this._workOnHeader(nextHeader), 0);
	}

	async _workOnHeader(nextHeader){
		const isPOW = await nextHeader.verify();
		if(isPOW) {
			this._stopWork();
			this.fire('mined-header',nextHeader);
		} else {
			nextHeader.nonce += 1;
		}
	}

	_stopWork(){
		if(this._worker) {
			clearInterval(this._worker);
		}
	}

	_getBodyHash(){
		return new Hash();
	}

	_getCurrentTimestamp(){
		return Math.round(Date.now() / 1000)
	}

	_getCurrentDifficulty(currHeader){
		return (this._getCurrentTimestamp() - currHeader.timestamp) > Policy.BLOCK_TIME ? currHeader.difficulty - 1 : currHeader.difficulty + 1;
	}

}