class Miner extends Observable {
    constructor(blockchain, mempool, minerAddress) {
        super();
        this._blockchain = blockchain;
        this._mempool = mempool;
        this._address = minerAddress;

        // Number of hashes computed since the last hashrate update.
        this._hashCount = [];

        // Timestamp of the last hashrate update.
        this._lastHashrate = 0;

        // The current hashrate of this miner.
        this._hashrate = 0;

        // The last hash counts used in the moving average.
        this._lastHashCounts = [];

        // The total hashCount used in the current moving average.
        this._totalHashCount = 0;

        // The time elapsed for the last measurements used in the moving average.
        this._lastElapsed = [];

        // The total time elapsed used in the current moving average.
        this._totalElapsed = 0;

        // The mining workers
        this._workers = [];

        // Listen to changes in the mempool which evicts invalid transactions
        // after every blockchain head change and then fires 'transactions-ready'
        // when the eviction process finishes. Restart work on the next block
        // with fresh transactions when this fires.
        this._mempool.on('transactions-ready', () => this._startWork());

        // Immediately start processing transactions when they come in.
        this._mempool.on('transaction-added', () => this._startWork());
    }

    startWork(numberOfWorkers) {
        if (this.working) {
            return;
        }

        numberOfWorkers = numberOfWorkers || 1;

        // Initialize hashrate computation.
        this._hashCount = new Array(numberOfWorkers).fill(0);
        this._lastElapsed = [];
        this._lastHashCounts = [];
        this._totalHashCount = 0;
        this._totalElapsed = 0;
        this._lastHashrate = Date.now();

        // Tell listeners that we've started working.
        this.fire('start', this);

        // Create worker
        for(let i = 0; i < numberOfWorkers; i++) {
            if(!this._workers[i]) {
                let worker = new Worker('../../dist/web-worker.js');
                worker.onmessage = e => {
                    const data = e.data;
                    switch(data.event) {
                        case 'hash-count': {
                            const prevValue = this._hashCount[data.id];

                            this._hashCount[data.id] = data.hashCount;

                            // Calculate hasrate
                            // - when all workers reported their hashCount and the array is full
                            // - when the calculation did not run since the last report of this worker
                            if(this._hashCount.indexOf(0) === -1 || prevValue !== 0) {
                                this._updateHashrate();
                            }

                            break;
                        }
                        case 'block-mined': {
                            // Tell listeners that we've mined a block.
                            const block = Block.unserialize(BufferUtils.fromBase64(data.block));

                            this.fire('block-mined', block, this);

                            // Push block into blockchain.
                            this._blockchain.pushBlock(block);

                            break;
                        }
                        case 'miner-stopped':
                            this._workers[data.id].terminate();
                            this._workers[data.id] = null;
                            break;
                    }
                };

                worker.postMessage({cmd: 'init-worker', id: i, hop: numberOfWorkers});
                this._workers[i] = worker;
            }
        }

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

        Log.i(Miner, `Starting work with ${this._workers.length} ${this._workers.length > 1 ? 'workers' : 'worker'} on ${block.header}, transactionCount=${block.transactionCount}, hashrate=${this._hashrate} H/s`);

        // Start hashing.
        // this._mine(block, buffer);
        const message = {
            cmd: 'start-mining',
            headHash: BufferUtils.toBase64(this._blockchain.headHash.serialize()),
            block: BufferUtils.toBase64(block.serialize()),
            buffer: BufferUtils.toBase64(buffer)
        };

        this._workers.forEach(function(worker) {
            worker.postMessage(message);
        });
    }

    async _getNextBlock() {
        const body = await this._getNextBody();
        const header = await this._getNextHeader(body);
        return new Block(header, body);
    }

    async _getNextHeader(body) {
        const prevHash = await this._blockchain.headHash;
        const accounts = await this._blockchain.createTemporaryAccounts();
        await accounts.commitBlockBody(body);
        const accountsHash = await accounts.hash();
        const bodyHash = await body.hash();
        const height = this._blockchain.height + 1;
        const timestamp = this._getNextTimestamp();
        const nBits = await this._blockchain.getNextCompactTarget();
        const nonce = Math.round(Math.random() * 100000);
        return new BlockHeader(prevHash, bodyHash, accountsHash, nBits, height, timestamp, nonce);
    }

    async _getNextBody() {
        // Get transactions from mempool (default is maxCount=5000).
        // TODO Completely fill up the block with transactions until the size limit is reached.
        const transactions = await this._mempool.getTransactions();
        return new BlockBody(this._address, transactions);
    }

    _getNextTimestamp() {
        const now = Math.floor(Date.now() / 1000);
        return Math.max(now, this._blockchain.head.timestamp + 1);
    }

    stopWork() {
        // TODO unregister from blockchain head-changed events.
        if (!this.working) {
            return;
        }

        this._hashrate = 0;
        this._lastElapsed = [];
        this._lastHashCounts = [];
        this._totalHashCount = 0;
        this._totalElapsed = 0;

        this._workers = this._workers.map(worker => {
            // worker.postMessage({cmd: 'stop-mining'});
            worker.terminate();
            return null;
        });

        // Tell listeners that we've stopped working.
        this.fire('stop', this);

        Log.i(Miner, 'Stopped work');
    }

    _updateHashrate() {
        const elapsed = (Date.now() - this._lastHashrate) / 1000;
        const hashCount = this._hashCount.reduce((acc, val) => { return acc + val; }, 0);

        // Enable next measurement.
        this._hashCount.fill(0);
        this._lastHashrate = Date.now();

        // Update stored information on moving average.
        this._lastElapsed.push(elapsed);
        this._lastHashCounts.push(hashCount);
        this._totalElapsed += elapsed;
        this._totalHashCount += hashCount;

        if (this._lastElapsed.length > Miner.MOVING_AVERAGE_MAX_SIZE) {
            const oldestElapsed = this._lastElapsed.shift();
            const oldestHashCount = this._lastHashCounts.shift();
            this._totalElapsed -= oldestElapsed;
            this._totalHashCount -= oldestHashCount;
        }

        this._hashrate = Math.round(this._totalHashCount / this._totalElapsed);

        // Tell listeners about our new hashrate.
        this.fire('hashrate-changed', this._hashrate, this);
    }

    get address() {
        return this._address;
    }

    get working() {
        return !!this._workers.find(e => {
            return !!e;
        });
    }

    get hashrate() {
        return this._hashrate;
    }
}
Miner.MOVING_AVERAGE_MAX_SIZE = 10;
Class.register(Miner);
