class AccountState {
    constructor(balance = 0, nonce = 0) {
        this._balance = balance;
        this._nonce = nonce;
    }

    static unserialize(buf) {
        let balance = buf.readUint64();
        let nonce = buf.readUint32();
        return new AccountState(balance, nonce);
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
        buf.writeUint64(this._balance);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get serializedSize() {
        return /*balance*/ 8
            + /*nonce*/ 4;
    }

    get balance() {
        return this._balance;
    }

    get nonce() {
        return this._nonce;
    }
}
