class Balance {
    /**
     * @param {Balance} o
     * @returns {Balance}
     */
    static copy(o) {
        if (!o) return o;
        return new Balance(o._value, o._nonce);
    }

    /**
     * @param {number} [value]
     * @param {number} [nonce]
     */
    constructor(value = 0, nonce = 0) {
        if (!NumberUtils.isUint64(value)) throw new Error('Malformed value');
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';

        this._value = value;
        this._nonce = nonce;
    }

    static unserialize(buf) {
        const value = buf.readUint64();
        const nonce = buf.readUint32();
        return new Balance(value, nonce);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint64(this._value);
        buf.writeUint32(this._nonce);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*value*/ 8
            + /*nonce*/ 4;
    }

    /**
     * @type {number}
     */
    get value() {
        return this._value;
    }

    /**
     * @type {number}
     */
    get nonce() {
        return this._nonce;
    }

    equals(o) {
        return o instanceof Balance
            && this._value === o.value
            && this._nonce === o.nonce;
    }
    
    toString() {
        return `Balance{value=${this._value}, nonce=${this._nonce}}`;
    }
}
Balance.INITIAL = new Balance();
Class.register(Balance);
