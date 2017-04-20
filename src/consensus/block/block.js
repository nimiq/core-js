class Block {
	constructor(header, body) {
		this._header = header;
		this._body = body;
	}

    static unserialize(buf) {
        var header = BlockHeader.unserialize(buf);
        var body = BlockBody.unserialize(buf);
        return new Block(header, body);
    }

    serialize(buf) {
        buf = buf || new Buffer();
        this._header.serialize(buf);
        this._body.serialize(buf);
        return buf;
    }

	get header() {
		return this._header;
	}

	get body() {
		return this._body;
	}
}
