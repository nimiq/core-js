class RawBlockHeader extends ArrayBuffer{
    constructor(prevHash, txRoot, stateRoot, difficulty, timestamp, nonce) {
        super(Constants.B_HEADER);
        
        const hashes = new Uint8Array(this,0,96);
        hashes.set(prevHash,0,32);
        hashes.set(new Uint8Array(txRoot),32,32);
        hashes.set(new Uint8Array(stateRoot),64,32);

        const uint32 = new Uint32Array(this,96);
        uint32[0] = difficulty | 0;
        uint32[1] = timestamp | 0;
        uint32[2] = nonce | 0;
	}
}

class BlockHeader extends Primitive{

    static create(rawBlockHeader){
        return new BlockHeader(rawBlockHeader);
    }

	constructor(serialized){
		super(serialized);
		return this._proofOfWork().then( proof => proof?this:false);
	}

    _proofOfWork(){   // verify: trailingZeros(hash) == difficulty
        return this.hash().then(hash => {    
            const view = new Uint8Array(hash);
            const zeroBytes = Math.floor(this.difficulty / 8);
            for(let i = 0; i < zeroBytes; i++){
                if(view[i] !== 0) return false;
            }
            const zeroBits = this.difficulty % 8;
            if(zeroBits && view[zeroBytes] > Math.pow(2, 8 - zeroBits )) return false;
            this.id = view;
            return true;
        });
    }

    get prevHash(){
        return this.view8(0,32);
    }    

    get txRoot(){
        return this.view8(32,32);
    }

    get stateRoot(){
        return this.view8(64,32);
    }

    get difficulty(){
        return this.view32(96);
    }

    get timestamp(){
        return this.view32(100);
    }    

    get nonce(){
        return this.view32(104);
    }

    successorOf(header){
        // TODO: check if difficulty matches
        return Buffer.equals(header.id, this.prevHash);
    }

    log(desc){
        super.log(desc,`BlockHeader
            id: ${Buffer.toBase64(this.id)}
            prev: ${Buffer.toBase64(this.prevHash)}
            tx-root: ${Buffer.toBase64(this.txRoot)}
            state-root: ${Buffer.toBase64(this.stateRoot)}
            difficulty: ${this.difficulty}, timestamp: ${this.timestamp}, nonce: ${this.nonce}`);
    }

    static sort(a,b){
        const timestampA = new Uint32Array(a,100,1)[0];
        const timestampB = new Uint32Array(b,100,1)[0];
        return timestampA - timestampB;
    }
}