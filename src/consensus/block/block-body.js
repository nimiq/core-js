class RawBlockBody{
	constructor(minerAddr,transactions){
		const buffer = new ArrayBuffer(Constants.ADDRESS_SIZE+transactions.length*Constants.TX_SIZE); 
		const view = new Uint8Array(buffer);
		view.set(new Uint8Array(minerAddr),0,Constants.ADDRESS_SIZE);
		transactions.forEach((t,i) => view.set(
			new Uint8Array(t.serialize()),
			Constants.ADDRESS_SIZE+i*Constants.TX_SIZE));
		return buffer;
	}
}

class BlockBody extends Primitive {
	constructor(rawBody){
		super(rawBody);
		return this._computeTxRoot();
	}

	_computeTxRoot(){
		return this.transactions()
			.then(txs => TransactionsTree.computeRoot([this.miner, ...txs])
			.then(root => {
				this.txRoot = new Uint8Array(root);
				return this;
			}))
	}

	transactions(){
		if(this._txs){
			return Promise.resolve(this._txs);
		}
		const len = this.txLength;
		const txPromises = [];
		for(let i=0; i<len; i++){
			txPromises.push(this._transaction(i));
		}
		return Promise.all(txPromises).then(txs => {
			this._txs = txs;
			return txs;
		});
	}

	_transaction(index){
		return new Transaction(this._buffer.slice(Constants.ADDRESS_SIZE+index*Constants.TX_SIZE,Constants.ADDRESS_SIZE+(1+index)*Constants.TX_SIZE));
	}

	get txLength(){
		return (this._buffer.byteLength-Constants.ADDRESS_SIZE)/Constants.TX_SIZE;
	} 

	get miner(){
		return this.view8(0,Constants.ADDRESS_SIZE);
	}

	log(desc){
        super.log(desc,`BlockBody
            tx-root: ${Buffer.toBase64(this.txRoot)}
            tx-count: ${this.txLength}`);
    }
}