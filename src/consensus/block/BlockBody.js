class BlockBody {

	constructor(minerAddr, transactions) {
		if (!(minerAddr instanceof Address)) throw 'Malformed minerAddr';
		if (!transactions || transactions.some( it => !(it instanceof Transaction))) throw 'Malformed transactions';
		this._minerAddr = minerAddr;
		this._transactions = transactions;
		this._numTransactions = transactions.length;
	}

	static cast(o) {
		if (!o) return o;
		ObjectUtils.cast(o, BlockBody);
		Address.cast(o._minerAddr);
		o._transactions.forEach( tx => Transaction.cast(tx));
		return o;
	}

	static unserialize(buf) {
		const minerAddr = Address.unserialize(buf);
		const numTransactions = buf.readUint16();
		const transactions = new Array(numTransactions);
		for (let i = 0; i < numTransactions; i++) {
			transactions[i] = Transaction.unserialize(buf);
		}
		return new BlockBody(minerAddr, transactions);
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		this._minerAddr.serialize(buf);
		buf.writeUint16(this._transactions.length);
		for (let tx of this._transactions) {
			tx.serialize(buf);
		}
		return buf;
	}

	get serializedSize() {
		let size = this._minerAddr.serializedSize
			+ /*transactionsLength*/ 2;
		for (let tx of this._transactions) {
			size += tx.serializedSize;
		}
		return size;
	}

	hash() {
		return BlockBody._computeRoot([this._minerAddr, ...this._transactions]);
	}

	static _computeRoot(values) {
		// values may contain:
		// - transactions (Transaction)
		// - miner address (Uint8Array)
		const len = values.length;
		if (len == 1) {
			const value = values[0];
			return value.hash ? /*transaction*/ value.hash() : /*miner address*/ Crypto.sha256(value);
		}

		const mid = Math.round(len / 2);
		const left = values.slice(0, mid);
		const right = values.slice(mid);
		return Promise.all([
					BlockBody._computeRoot(left),
					BlockBody._computeRoot(right)
				])
			.then( hashes => Crypto.sha256(BufferUtils.concat(hashes[0], hashes[1])));
	}

	equals(o) {
		return o instanceof BlockBody
			&& this._minerAddr.equals(o.minerAddr)
			&& this._transactions.every( (tx, i) => tx.equals(o.transactions[i]) );
    }

	/*
	static prove(strings, root){
		return TransactionsTree.computeRoot(strings)
			.then( treeRoot => (root === treeRoot) )
	}
	*/

	get minerAddr() {
		return this._minerAddr;
	}

	get transactions() {
		return this._transactions;
	}

	get numTransactions() {
		return this._transactions.length;
	}

	log(desc) {
        super.log(desc,`BlockBody
            tx-root: ${Buffer.toBase64(this.txRoot)}
            tx-count: ${this.txLength}`);
    }
}
