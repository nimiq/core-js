class Block{
	constructor(header,body){
		if(!Buffer.equals(header.txRoot,body.txRoot)) throw 'txRoot error';
		this.header = header;
		this.body = body;
	}

	successorOf(block){
		return this.header.successorOf(block.header);
	}

	get difficulty(){
		return this.header.difficulty;
	}
}