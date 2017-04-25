class Miner {
	constructor(blockchain, minerAddress){
		this._blockchain = blockchain;
		this._address = minerAddress || new Address();
		if (!minerAddress || ! minerAddress instanceof Address) {
			console.warn('No miner address set');
		}

		this._worker = null;

		this._hashCount = 0;
		this._hashrate = 0;
		this._hashrateWorker = null;
	}

	startWork() {
		this._blockchain.on('head-changed', head => this._onChainHead(head));

		this._hashCount = 0;
		this._hashrateWorker = setInterval( () => this._updateHashrate(), 5000);

		this._onChainHead(this._blockchain.head);
	}

	stopWork() {
		// TODO unregister from head-changed events
		this._stopWork();
		console.log('Miner stopped work');
	}

	_stopWork() {
		if (this._worker) {
			clearTimeout(this._worker);
			this._worker = null;
		}
		if (this._hashrateWorker) {
			clearInterval(this._hashrateWorker);
			this._hashrateWorker = null;
		}

		this._hashCount = 0;
		this._hashrate = 0;
	}

	async _onChainHead(head) {
		if (this._worker) {
			clearTimeout(this._worker);
		}

		const nextBody = await this._getNextBody();

		const prevHash = await head.hash();
		const accountsHash = this._blockchain.accountsHash;
		const bodyHash = await nextBody.hash();
		const timestamp = this._getNextTimestamp();
		const difficulty = this._getNextDifficulty(head.header);
		const nonce = Math.round(Math.random() * 100000);

		console.log('Miner starting work on prevHash=' + prevHash.toBase64() + ', accountsHash=' + accountsHash.toBase64() + ', difficulty=' + difficulty);

		const nextHeader = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

		this._worker = setTimeout( () => this._workOnHeader(nextHeader, nextBody), 0);
	}

	async _workOnHeader(nextHeader, nextBody) {
		// If the blockchain head has changed in the meantime, abort.
		if (!this._blockchain.headHash.equals(nextHeader.prevHash)) {
			return;
		}

		for (let i = 0; i < 75; ++i) {
			let isPoW = await nextHeader.verify();
			this._hashCount++;

			if (isPoW) {
				const hash = await nextHeader.hash();
				console.log('MINED BLOCK!!! nonce=' + nextHeader.nonce + ', difficulty=' + nextHeader.difficulty + ', hash=' + hash.toBase64());

				await this._blockchain.pushBlock(new Block(nextHeader,nextBody));
				return;
			}

			nextHeader.nonce += 1;
		}

		this._worker = setTimeout( () => this._workOnHeader(nextHeader, nextBody), 0);
	}

	_updateHashrate() {
		// Called in 5 second intervals
		this._hashrate = Math.round(this._hashCount / 5);
		this._hashCount = 0;
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

	get hashrate() {
		return this._hashrate;
	}

}
