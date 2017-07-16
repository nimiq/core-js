class GetAccountsProofMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     */
    constructor(blockHash, addresses) {
        super(Message.Type.GETACCOUNTSPROOF);
        if (!blockHash|| !(blockHash instanceof Hash)) throw 'Malformed blockHash';
        if (!addresses || !NumberUtils.isUint16(addresses.length)
            || addresses.some(it => !(it instanceof Address))) throw 'Malformed addresses';
        /** @type {Hash} */
        this._blockHash = blockHash;
        /** @type {Array.<Address>} */
        this._addresses = addresses;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetAccountsProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const count = buf.readUint16();
        const addresses = [];
        for (let i = 0; i < count; i++) {
            addresses.push(Address.unserialize(buf));
        }
        return new GetAccountsProofMessage(blockHash, addresses);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        buf.writeUint16(this._addresses.length);
        for (const address of this._addresses) {
            address.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*blockHash*/ this._blockHash.serializedSize
            + /*count*/ 2;
        for (const address of this._addresses) {
            size += address.serializedSize;
        }
        return size;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {Array.<Address>} */
    get addresses() {
        return this._addresses;
    }
}
Class.register(GetAccountsProofMessage);
