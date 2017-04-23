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
        buf = buf || new Buffer(this.serializedSize);
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

	hash() {
		return this._header.hash();
	}

	isSuccessorOf(block) {
		return this._header.isSuccessorOf(block.header);
	}
}

/* Genesis Block */
Block.GENESIS = new Block(
	new BlockHeader(new Hash(), new Hash('Xmju8G32zjPl4m6U/ULB3Nyozs2BkVgX2k9fy5/HeEg='), new Hash('lqKW0iTyhcZ77pPDD4owkVfw2qNdxbh+QQt4YwoJz8c='), 1, 0, 0),
	new BlockBody(new Address('kekkD0FSI5gu3DRVMmMHEOlKf1I'), [])
);
