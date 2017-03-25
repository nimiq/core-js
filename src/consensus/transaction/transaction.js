// TODO V2: Transactions may contain a payment reference such that the chain can prove existence of data
// TODO V2: Copy 'serialized' to detach all outer references 
class RawTx extends ArrayBuffer {
    constructor(value, receiver, fee, nonce){
        super(Constants.TX_SIZE_RAW);
        const valueView = new Float64Array(this,0,1);
        valueView[0] = value;
        const view = new Uint32Array(this,8,2);
        view[0] = fee;
        view[1] = nonce;
        const view2 = new Uint8Array(this,16,Constants.ADDRESS_SIZE);
        view2.set(receiver,0,Constants.ADDRESS_SIZE);
    }
}

class Transaction extends Primitive {

    static create(rawTx, sender, signature){
        const buffer = new ArrayBuffer(Constants.TX_SIZE);
        const view = new Uint8Array(buffer);
        view.set(new Uint8Array(rawTx), 0);
        view.set(new Uint8Array(sender), Constants.TX_SIZE_RAW);
        view.set(new Uint8Array(signature), Constants.TX_SIZE_RAW + Constants.PUBLIC_KEY_SIZE);
        return new Transaction(buffer);
    }

    constructor(serialized){
        super(serialized);
        if(this.value <= 0 || this.value > Number.MAX_SAFE_INTEGER) throw 'Malformed Value';
        if(this.fee <= 0) throw 'Malformed Fee';
        if(this.nonce < 0) throw 'Malformed Nonce';
        Object.freeze(this);
        return Crypto.verify(this.sender, this.signature, this.rawTx)
            .then( success => { 
                if(!success) throw 'Malformed Signature';
                return this;
            });
    }

    get value(){
        return new Float64Array(this._buffer,0,1)[0];
    } 

    get fee(){
        return this.view32(8);
    }

    get nonce(){
        return this.view32(12);
    }

    get receiver(){
        return this.view8(16,Constants.ADDRESS_SIZE);
    }    

    get sender(){
        return this.view8(Constants.TX_SIZE_RAW,Constants.PUBLIC_KEY_SIZE);
    }

    senderAddr(){
        return Crypto.publicToAddress(this.sender);
    }

    get signature(){
        return this.view8(Constants.TX_SIZE_RAW+Constants.PUBLIC_KEY_SIZE,Constants.SIGNATURE_SIZE);
    }

    get rawTx(){
        return this.view8(0,Constants.TX_SIZE_RAW);
    }

    log(desc){
        this.senderAddr().then(addr => {
            super.log(desc,`Transaction:
            sender: ${Buffer.toBase64(addr)}
            receiver: ${Buffer.toBase64(this.receiver)} 
            signature: ${Buffer.toBase64(this.signature)} 
            value: ${this.value} fee: ${this.fee}, nonce: ${this.nonce}`);
        });
    }
}