class BlockHeader {

    constructor(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce) {
        this._prevHash = prevHash;
        this._bodyHash = bodyHash;
        this._accountsHash = accountsHash;
        this._difficulty = difficulty;
        this._timestamp = timestamp;
        this._nonce = nonce;
    }

    static unserialize(buf) {
        var prevHash = buf.readHash();
        var bodyHash = buf.readHash();
        var accountsHash = buf.readHash();
        var difficulty = buf.readUint32();
        var timestamp = buf.readUint64();
        var nonce = buf.readUint64();
        return new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);
    }

    serialize(buf) {
        buf = buf || new Buffer();
        buf.writeHash(this._prevHash);
        buf.writeHash(this._bodyHash);
        buf.writeHash(this._accountsHash);
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

    get bodyHash() {
        return this._bodyHash;
    }

    get accountsHash() {
        return this._accountsHash;
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
            tx-root: ${Buffer.toBase64(this._bodyHash)}
            state-root: ${Buffer.toBase64(this._accountsHash)}
            difficulty: ${this._difficulty}, timestamp: ${this._timestamp}, nonce: ${this._nonce}`);
    }

}
