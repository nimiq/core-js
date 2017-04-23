class Miner{
	constructor(blockchain, minerAddress){
		this._blockchain = blockchain;
		blockchain.on('head', b => this._onChainHead(b));

		this._address = minerAddress || new Address();
		if(!minerAddress || ! minerAddress instanceof Address){
			console.warn('No Miner Address set');
		}
		
		this._worker = null;
	}

	async _onChainHead(currHeader){
		this._stopWork();
	
		const nextBody = await this._getNextBody();

		const prevHash = await currHeader.hash();
		const accountsHash = this._blockchain.getAccountsHash();
		const bodyHash = await nextBody.hash();
		const timestamp = this._getNextTimestamp();
		const difficulty = this._getNextDifficulty(currHeader);
		const nonce = 0;

		const nextHeader = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

		this._worker = setInterval( () => this._workOnHeader(nextHeader,nextBody), 0);
	}

	async _workOnHeader(nextHeader,nextBody){
		const isPOW = await nextHeader.verify();
		if(isPOW) {
			this._stopWork();
			this._blockchain.pushBlock(new Block(nextHeader,nextBody));
		} else {
			nextHeader.nonce += 1;
		}
	}

	_stopWork(){
		if(this._worker) {
			clearInterval(this._worker);
		}
	}

	_getNextBody(){
		return new BlockBody(this._address,[]);
	}

	_getNextTimestamp(){
		return Math.round(Date.now() / 1000)
	}

	_getNextDifficulty(currHeader){
		return (this._getNextTimestamp() - currHeader.timestamp) > Policy.BLOCK_TIME ? currHeader.difficulty - 1 : currHeader.difficulty + 1;
	}

}