class Miner extends Observable {
	constructor(minerAddress, blockchain, mempool) {
		super();
		this._blockchain = blockchain;
		this._mempool = mempool;

		// XXX Cleanup
		this._address = minerAddress || new Address();
		if (!minerAddress || !(minerAddress instanceof Address)) {
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

		// Listen to changes in the mempool which evicts invalid transactions
		// after every blockchain head change and then fires 'transactions-ready'
		// when the eviction process finishes. Restart work on the next block
		// with fresh transactions when this fires.
		this._mempool.on('transactions-ready', () => this._startWork());

		// Initialize hashrate computation.
		this._hashCount = 0;
		this._hashrateWorker = setInterval( () => this._updateHashrate(), 5000);

		// Tell listeners that we've started working.
		this.fire('start', this);

		// Kick off the mining process.
		this._startWork();
	}

	async _startWork() {
		// XXX Needed as long as we cannot unregister from transactions-ready events.
		if (!this.working) {
			return;
		}

		// XXX Necessary?
		if (this._worker) {
			clearTimeout(this._worker);
		}

		// Construct next block.
		const nextBlock = await this._getNextBlock();

		console.log('Miner starting work on prevHash=' + nextBlock.prevHash.toBase64() + ', accountsHash=' + nextBlock.accountsHash.toBase64() + ', difficulty=' + nextBlock.difficulty);

		// Start hashing.
		this._worker = setTimeout( () => this._tryNonces(nextBlock), 0);
	}

	async _tryNonces(block) {
		// If the blockchain head has changed in the meantime, abort.
		if (!this._blockchain.headHash.equals(block.prevHash)) {
			return;
		}

		// If we are supposed to stop working, abort.
		if (!this.working) {
			return;
		}

		// Play with this number to adjust hashrate vs. responsiveness.
		const iterations = 75;
		for (let i = 0; i < iterations; ++i) {
			let isPoW = await block.header.verifyProofOfWork();
			this._hashCount++;

			if (isPoW) {
				const hash = await block.hash();
				console.log('MINED BLOCK!!! nonce=' + block.nonce + ', difficulty=' + block.difficulty + ', hash=' + hash.toBase64());

				// Tell listeners that we've mined a block.
				this.fire('block-mined', block, this);

				await this._blockchain.pushBlock(block);
				return;
			}

			block.header.nonce += 1;
		}

		this._worker = setTimeout( () => this._tryNonces(block), 0);
	}

	async _getNextBlock() {
		const body = await this._getNextBody();
		const header = await this._getNextHeader(body);
		return new Block(header, body);
	}

	async _getNextHeader(body) {
		const prevHash = await this._blockchain.headHash;
		const accountsHash = this._blockchain.accountsHash;
		const bodyHash = await body.hash();
		const timestamp = this._getNextTimestamp();
		const difficulty = this._getNextDifficulty(this._blockchain.head.header);
		const nonce = Math.round(Math.random() * 100000);
		return new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);
	}

	async _getNextBody() {
		// Get transactions from mempool (default is maxCount=5000).
		// TODO Completely fill up the block with transactions until the size limit is reached.
		const transactions = await this._mempool.getTransactions();
		return new BlockBody(this._address, transactions);
	}

	_getNextTimestamp() {
		return Math.round(Date.now() / 1000)
	}

	_getNextDifficulty(header) {
		return (this._getNextTimestamp() - header.timestamp) > Policy.BLOCK_TIME ? header.difficulty - 1 : header.difficulty + 1;
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

	_updateHashrate() {
		// Called in 5 second intervals
		this._hashrate = Math.round(this._hashCount / 5);
		this._hashCount = 0;

		// Tell listeners about our new hashrate.
		this.fire('hashrate-changed', this._hashrate, this);
	}

	get address() {
		return this._address;
	}

	get working() {
		return !!this._hashrateWorker;
	}

	get hashrate() {
		return this._hashrate;
	}
}
