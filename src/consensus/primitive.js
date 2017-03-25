class Primitive{
	constructor(serialized){
		this._buffer = serialized.buffer || serialized;
	}

	hash(){
		return Crypto.sha256(this._buffer);
	}

	serialize(){
		return this._buffer;
	}

	toBase64(){
		return Buffer.toBase64(this._buffer);
	}

	toString(){
		return this.toBase64();
	}

	view8(start, length){
		return new Uint8Array(this._buffer, start, length);
	}

	view32(start){
		return new Uint32Array(this._buffer, start, 1)[0] | 0;
	}

	log(desc, string){
		setTimeout( _ => console.debug(desc, string), 1);	// Async logging after current event loop
	}
}


