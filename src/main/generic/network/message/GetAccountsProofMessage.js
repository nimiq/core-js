class GetAccountsProofMessage extends Message {
    /**
     * @param {Array.<Address>} addresses
     */
    constructor(addresses) {
        super(Message.Type.GET_ACCOUNTS_PROOF);
        if (!addresses || !NumberUtils.isUint16(addresses.length)
            || addresses.some(it => !(it instanceof Address))) throw 'Malformed addresses';
        /** @type {Array.<Address>} */
        this._addresses = addresses;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetAccountsProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const addresses = [];
        for (let i = 0; i < count; i++) {
            addresses.push(Address.unserialize(buf));
        }
        return new GetAccountsProofMessage(addresses);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._addresses.length);
        for (const address of this._addresses) {
            address.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*count*/ 2
            + this._addresses.reduce((sum, address) => sum + address.serializedSize, 0);
    }

    /** @type {Array.<Address>} */
    get addresses() {
        return this._addresses;
    }
}
Class.register(GetAccountsProofMessage);
