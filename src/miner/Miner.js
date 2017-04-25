class Miner extends Observable {
	constructor(blockchain, minerAddress) {
		super();
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
		if (this.working) {
			console.warn('Miner already working');
			return;
		}

		// Listen work changes in the blockchain head to restart work if it changes.
		this._blockchain.on('head-changed', head => this._onChainHead(head));

		// Initialize hashrate computation.
		this._hashCount = 0;
		this._hashrateWorker = setInterval( () => this._updateHashrate(), 5000);

		// Tell listeners that we've started working.
		this.fire('start', this);

		// Kick off the mining process.
		this._onChainHead(this._blockchain.head);
	}

	stopWork() {
		// TODO unregister from head-changed events
		this._stopWork();

		console.log('Miner stopped work');

		// Tell listeners that we've stopped working.
		this.fire('stop', this);
	}

	_stopWork() {
		// TODO unregister from blockchain head-changed events.

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
		// XXX Needed as long as we cannot unregister from head-changed events.
		if (!this.working) {
			return;
		}

		// XXX Necessary?
		if (this._worker) {
			clearTimeout(this._worker);
		}

		// Construct next block.
		const nextBody = await this._getNextBody();

		const prevHash = await head.hash();
		const accountsHash = this._blockchain.accountsHash;
		const bodyHash = await nextBody.hash();
		const timestamp = this._getNextTimestamp();
		const difficulty = this._getNextDifficulty(head.header);
		const nonce = Math.round(Math.random() * 100000);

		const nextHeader = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

		console.log('Miner starting work on prevHash=' + prevHash.toBase64() + ', accountsHash=' + accountsHash.toBase64() + ', difficulty=' + difficulty);

		// Start hashing.
		this._worker = setTimeout( () => this._workOnHeader(nextHeader, nextBody), 0);
	}

	async _workOnHeader(nextHeader, nextBody) {
		// If the blockchain head has changed in the meantime, abort.
		if (!this._blockchain.headHash.equals(nextHeader.prevHash)) {
			return;
		}

		// If we are supposed to stop working, abort.
		if (!this.working) {
			return;
		}

		for (let i = 0; i < 75; ++i) {
			let isPoW = await nextHeader.verify();
			this._hashCount++;

			if (isPoW) {
				const hash = await nextHeader.hash();
				console.log('MINED BLOCK!!! nonce=' + nextHeader.nonce + ', difficulty=' + nextHeader.difficulty + ', hash=' + hash.toBase64());

				// Tell listeners that we've mined a block.
				// TODO we should pass the block here.
				this.fire('block-mined', nextHeader, this);

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

		// Tell listeners about our new hashrate.
		this.fire('hashrate-changed', this._hashrate, this);
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

	get working() {
		return !!this._hashrateWorker;
	}

	get hashrate() {
		return this._hashrate;
	}

}
