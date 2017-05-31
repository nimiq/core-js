class Miner extends Observable {
    constructor(blockchain, mempool, minerAddress) {
        super();
        this._blockchain = blockchain;
        this._mempool = mempool;
        this._address = minerAddress;

        // Number of hashes computed since the last hashrate update.
        this._hashCount = 0;

        // Timestamp of the last hashrate update.
        this._lastHashrate = 0;

        // Hashrate computation interval handle.
        this._hashrateWorker = null;

        // The current hashrate of this miner.
        this._hashrate = 0;

        // Listen to changes in the mempool which evicts invalid transactions
        // after every blockchain head change and then fires 'transactions-ready'
        // when the eviction process finishes. Restart work on the next block
        // with fresh transactions when this fires.
        this._mempool.on('transactions-ready', () => this._startWork());

        // Immediately start processing transactions when they come in.
        this._mempool.on('transaction-added', () => this._startWork());
    }

    startWork() {
        if (this.working) {
            Log.w(Miner, 'Already working');
            return;
        }

        // Initialize hashrate computation.
        this._hashCount = 0;
        this._lastHashrate = Date.now();
        this._hashrateWorker = setInterval(() => this._updateHashrate(), 5000);

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

        // Construct next block.
        const block = await this._getNextBlock();
        const buffer = block.header.serialize();

        Log.i(Miner, `Starting work on ${block.header}, transactionCount=${block.transactionCount}, hashrate=${this._hashrate} H/s`);

        // Start hashing.
        this._mine(block, buffer);
    }


    async _mine(block, buffer) {
        // Abort mining if the blockchain head changed.
        if (!this._blockchain.headHash.equals(block.prevHash)) {
            return;
        }

        // Abort mining if the user stopped the miner.
        if (!this.working) {
            return;
        }

        // Reset the write position of the buffer before re-using it.
        buffer.writePos = 0;

        // Compute hash and check if it meets the proof of work condition.
        const isPoW = await block.header.verifyProofOfWork(buffer);

        // Keep track of how many hashes we have computed.
        this._hashCount++;

        // Check if we have found a block.
        if (isPoW) {
            // Tell listeners that we've mined a block.
            this.fire('block-mined', block, this);

            // Push block into blockchain.
            this._blockchain.pushBlock(block);
        } else {
            // Increment nonce.
            block.header.nonce++;

            // Continue mining.
            this._mine(block, buffer);
        }
    }

    async _getNextBlock() {
        const body = await this._getNextBody();
        const header = await this._getNextHeader(body);
        return new Block(header, body);
    }

    async _getNextHeader(body) {
        const prevHash = await this._blockchain.headHash;
        const accountsHash = await this._blockchain.accountsHash();
        const bodyHash = await body.hash();
        const timestamp = this._getNextTimestamp();
        const nBits = await this._blockchain.getNextCompactTarget();
        const nonce = Math.round(Math.random() * 100000);
        return new BlockHeader(prevHash, bodyHash, accountsHash, nBits, timestamp, nonce);
    }

    async _getNextBody() {
        // Get transactions from mempool (default is maxCount=5000).
        // TODO Completely fill up the block with transactions until the size limit is reached.
        const transactions = await this._mempool.getTransactions();
        return new BlockBody(this._address, transactions);
    }

    _getNextTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    stopWork() {
        // TODO unregister from blockchain head-changed events.

        if (this._hashrateWorker) {
            clearInterval(this._hashrateWorker);
            this._hashrateWorker = null;
        }

        this._hashrate = 0;

        // Tell listeners that we've stopped working.
        this.fire('stop', this);

        Log.i(Miner, 'Stopped work');
    }

    _updateHashrate() {
        const elapsed = (Date.now() - this._lastHashrate) / 1000;
        this._hashrate = Math.round(this._hashCount / elapsed);

        this._hashCount = 0;
        this._lastHashrate = Date.now();

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
Class.register(Miner);
