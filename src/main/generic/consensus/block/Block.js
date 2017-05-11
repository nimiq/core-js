class Block {
	constructor(header, body) {
		if (!(header instanceof BlockHeader)) throw 'Malformed header';
		if (!(body instanceof BlockBody)) throw 'Malformed body';
		this._header = header;
		this._body = body;
	}

	static cast(o) {
		if (!o) return o;
		ObjectUtils.cast(o, Block);
		BlockHeader.cast(o._header);
		BlockBody.cast(o._body);
		return o;
	}

    static unserialize(buf) {
        var header = BlockHeader.unserialize(buf);
        var body = BlockBody.unserialize(buf);
        return new Block(header, body);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._header.serialize(buf);
        this._body.serialize(buf);
        return buf;
    }

	get serializedSize() {
		return this._header.serializedSize
			+ this._body.serializedSize;
	}

	get header() {
		return this._header;
	}

	get body() {
		return this._body;
	}

	get prevHash() {
		return this._header.prevHash;
	}

	get bodyHash() {
		return this._header.bodyHash;
	}

	get accountsHash() {
		return this._header.accountsHash;
	}

	get difficulty() {
		return this._header.difficulty;
	}

	get timestamp() {
		return this._header.timestamp;
	}

	get nonce() {
		return this._header.nonce;
	}

	get minerAddr() {
		return this._body.minerAddr;
	}

	get transactions() {
		return this._body.transactions;
	}

	get transactionCount() {
		return this._body.transactionCount;
	}

	hash() {
		return this._header.hash();
	}
}

/* Genesis Block */
Block.GENESIS = new Block(
	new BlockHeader(new Hash(), new Hash('Xmju8G32zjPl4m6U/ULB3Nyozs2BkVgX2k9fy5/HeEg='), new Hash('cJ6AyISHokEeHuTfufIqhhSS0gxHZRUMDHlKvXD4FHw='), 10, 0, 0),
	new BlockBody(new Address('kekkD0FSI5gu3DRVMmMHEOlKf1I'), [])
);
// Store hash for synchronous access
Block.GENESIS.hash().then( hash => {
	Block.GENESIS.HASH = hash;
	Object.freeze(Block.GENESIS);
});
Class.register(Block);
