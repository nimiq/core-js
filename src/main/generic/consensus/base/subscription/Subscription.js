class Subscription {
    /**
     * @param {boolean} enabled
     */
    constructor(enabled) {
        this._enabled = enabled;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Transaction}
     */
    static unserialize(buf) {
        const enabled = buf.readUint8() === 1;
        return new Subscription(enabled);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._enabled ? 1 : 0);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*enabled*/ 1;
    }

    /**
     * @param {Block} block
     * @returns {boolean}
     */
    matchesBlock(block) {
        return this._enabled;
    }

    /**
     * @param {Transaction} transaction
     * @returns {boolean}
     */
    matchesTransaction(transaction) {
        return this._enabled;
    }

    /**
     * @returns {string}
     */
    toString() {
        return `Subscription{enabled=${this._enabled}}`;
    }
}
Subscription.NONE = new Subscription(false);
Subscription.ANY = new Subscription(true);
Class.register(Subscription);
