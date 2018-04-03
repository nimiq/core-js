class Subscription {
    /**
     * @param {Array.<Address>} addresses
     */
    static fromAddresses(addresses) {
        return new Subscription(Subscription.Type.ADDRESSES, addresses);
    }

    /**
     * @param {number} minFeePerByte
     */
    static fromMinFeePerByte(minFeePerByte) {
        return new Subscription(Subscription.Type.MIN_FEE, minFeePerByte);
    }

    /**
     * @param {Subscription.Type} type
     * @param {Array.<Address>|number} [filter]
     */
    constructor(type, filter=null) {
        if (!NumberUtils.isUint8(type)) throw new Error('Invalid type');
        if (type === Subscription.Type.ADDRESSES
            && (!Array.isArray(filter) || !NumberUtils.isUint16(filter.length)
            || filter.some(it => !(it instanceof Address)))) throw new Error('Invalid addresses');
        if (type === Subscription.Type.MIN_FEE && !NumberUtils.isUint64(filter)) throw new Error('Invalid minFeePerByte');
        this._type = type;

        this._addresses = new HashSet();
        this._minFeePerByte = 0;

        switch (type) {
            case Subscription.Type.ADDRESSES:
                this._addresses.addAll(filter);
                break;
            case Subscription.Type.MIN_FEE:
                this._minFeePerByte = filter;
                break;
        }
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Subscription}
     */
    static unserialize(buf) {
        const type = /** @type {Subscription.Type} */ buf.readUint8();
        let filter = null;
        switch (type) {
            case Subscription.Type.ADDRESSES: {
                filter = [];
                const size = buf.readUint16();
                for (let i = 0; i < size; ++i) {
                    filter.push(Address.unserialize(buf));
                }
                break;
            }
            case Subscription.Type.MIN_FEE:
                filter = buf.readUint64();
                break;
        }
        return new Subscription(type, filter);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._type);
        switch (this._type) {
            case Subscription.Type.ADDRESSES:
                buf.writeUint16(this._addresses.length);
                for (const address of this._addresses) {
                    address.serialize(buf);
                }
                break;
            case Subscription.Type.MIN_FEE:
                buf.writeUint64(this._minFeePerByte);
                break;
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let additionalSize = 0;
        switch (this._type) {
            case Subscription.Type.ADDRESSES:
                additionalSize = /*length*/ 2;
                for (const address of this._addresses) {
                    additionalSize += address.serializedSize;
                }
                break;
            case Subscription.Type.MIN_FEE:
                additionalSize = /*minFeePerByte*/ 8;
                break;
        }
        return /*type*/ 1
            + additionalSize;
    }

    /**
     * @param {Block} block
     * @returns {boolean}
     */
    matchesBlock(block) {
        switch (this._type) {
            case Subscription.Type.NONE:
                return false;
            case Subscription.Type.ANY:
            case Subscription.Type.ADDRESSES:
            case Subscription.Type.MIN_FEE:
                return true;
            default:
                throw new Error('Unknown type');
        }
    }

    /**
     * @param {Transaction} transaction
     * @returns {boolean}
     */
    matchesTransaction(transaction) {
        switch (this._type) {
            case Subscription.Type.NONE:
                return false;
            case Subscription.Type.ANY:
                return true;
            case Subscription.Type.ADDRESSES:
                return this._addresses.contains(transaction.recipient) || this._addresses.contains(transaction.sender);
            case Subscription.Type.MIN_FEE:
                return transaction.fee / transaction.serializedSize >= this._minFeePerByte;
            default:
                throw new Error('Unknown type');
        }
    }

    /**
     * @returns {string}
     */
    toString() {
        return `Subscription{type=${this._type}, addresses=[${this._addresses.values()}], minFeePerByte=${this._minFeePerByte}}`;
    }

    /** @type {Subscription.Type} */
    get type() {
        return this._type;
    }

    /** @type {Array.<Address>} */
    get addresses() {
        return this._addresses.values();
    }

    /** @type {number} */
    get minFeePerByte() {
        return this._minFeePerByte;
    }
}
/** @enum {number} */
Subscription.Type = {
    NONE: 0,
    ANY: 1,
    ADDRESSES: 2,
    MIN_FEE: 3
};
Subscription.NONE = new Subscription(Subscription.Type.NONE);
Subscription.BLOCKS_ONLY = new Subscription(Subscription.Type.ADDRESSES, []);
Subscription.ANY = new Subscription(Subscription.Type.ANY);
Class.register(Subscription);
