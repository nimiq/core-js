class BlockHeader {

    constructor(prevHash, txHash, stateHash, difficulty, timestamp, nonce) {
        this._prevHash = prevHash;
        this._txHash = txHash;
        this._stateHash = stateHash;
        this._difficulty = difficulty;
        this._timestamp = timestamp;
        this._nonce = nonce;
    }

    static unserialize(buf) {
        var prevHash = buf.readHash();
        var txHash = buf.readHash();
        var stateHash = buf.readHash();
        var difficulty = buf.readUint32();
        var timestamp = buf.readUint64();
        var nonce = buf.readUint64();
        return new BlockHeader(prevHash, txHash, stateHash, difficulty, timestamp, nonce);
    }

    serialize(buf) {
        buf = buf || new Buffer();
        buf.writeHash(this._prevHash);
        buf.writeHash(this._txHash);
        buf.writeHash(this._stateHash);
        buf.writeUint32(this._difficulty);
        buf.writeUint64(this._timestamp);
        buf.writeUint64(this._nonce);
        return buf;
    }

    /*
    _proofOfWork() {   // verify: trailingZeros(hash) == difficulty
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
    */

    get prevHash() {
        return this._prevHash;
    }

    get txHash() {
        return this._txHash;
    }

    get stateHash() {
        return this._stateHash;
    }

    get difficulty() {
        return this._difficulty;
    }

    get timestamp() {
        return this._timestamp;
    }

    get nonce() {
        return this._nonce;
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }

    /*
    isSuccessorOf(header) {
        // TODO: check if difficulty matches
        return Buffer.equals(header.id, this.prevHash);
    }
    */

    log(desc) {
        super.log(desc, `BlockHeader
            prev: ${Buffer.toBase64(this._prevHash)}
            tx-root: ${Buffer.toBase64(this._txRoot)}
            state-root: ${Buffer.toBase64(this._stateRoot)}
            difficulty: ${this._difficulty}, timestamp: ${this._timestamp}, nonce: ${this._nonce}`);
    }

}
