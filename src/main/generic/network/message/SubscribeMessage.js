class SubscribeMessage extends Message {
    constructor(subscription) {
        super(Message.Type.SUBSCRIBE);
        this._subscription = subscription;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {SubscribeMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const subscription = Subscription.unserialize(buf);
        return new SubscribeMessage(subscription);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._subscription.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._subscription.serializedSize;
    }

    /** @type {Subscription} */
    get subscription() {
        return this._subscription;
    }

    toString() {
        return `SubscribeMessage{${this._subscription}}`;
    }
}
Class.register(SubscribeMessage);
