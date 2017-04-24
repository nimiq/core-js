class Miner {
	constructor(blockchain, minerAddress){
		this._blockchain = blockchain;
		this._address = minerAddress || new Address();
		if (!minerAddress || ! minerAddress instanceof Address) {
			console.warn('No Miner Address set');
		}

		this._worker = null;
	}

	startWork() {
		this._blockchain.on('head-changed', b => this._onChainHead(b));
		this._onChainHead(this._blockchain.head);
	}

	async _onChainHead(head) {
		this._stopWork();

		const nextBody = await this._getNextBody();

		const prevHash = await head.hash();
		const accountsHash = this._blockchain.accountsHash;
		const bodyHash = await nextBody.hash();
		const timestamp = this._getNextTimestamp();
		const difficulty = this._getNextDifficulty(head.header);
		const nonce = Math.round(Math.random() * 100000);

		console.log('Miner starting work on prevHash=' + prevHash.toBase64() + ', accountsHash=' + accountsHash.toBase64() + ', difficulty=' + difficulty);

		const nextHeader = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

		this._worker = setInterval( () => this._workOnHeader(nextHeader, nextBody), 0);
	}

	async _workOnHeader(nextHeader, nextBody) {
		const isPoW = await nextHeader.verify();
		if (isPoW) {
			const hash = await nextHeader.hash();
			console.log('MINED BLOCK!!! nonce=' + nextHeader.nonce + ', difficulty=' + nextHeader.difficulty + ', hash=' + hash.toBase64());

			this._stopWork();
			await this._blockchain.pushBlock(new Block(nextHeader,nextBody));
		} else {
			nextHeader.nonce += 1;
		}
	}

	_stopWork() {
		if(this._worker) {
			clearInterval(this._worker);
		}
	}

	_getNextBody() {
		return new BlockBody(this._address,[]);
	}

	_getNextTimestamp() {
		return Math.round(Date.now() / 1000)
	}

	_getNextDifficulty(header) {
		return (this._getNextTimestamp() - header.timestamp) > Policy.BLOCK_TIME ? header.difficulty - 1 : header.difficulty + 1;
	}

}
