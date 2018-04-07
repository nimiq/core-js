class GetAccountsProofMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     */
    constructor(blockHash, addresses) {
        super(Message.Type.GET_ACCOUNTS_PROOF);
        if (!blockHash || !(blockHash instanceof Hash)) throw new Error('Malformed block hash');
        if (!addresses || !NumberUtils.isUint16(addresses.length)
            || addresses.length < 1
            || addresses.length > GetAccountsProofMessage.ADDRESSES_MAX_COUNT
            || addresses.some(it => !(it instanceof Address))) throw new Error('Malformed addresses');
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
     * @param {SerialBuffer} [buf]
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
        return super.serializedSize
            + this._blockHash.serializedSize
            + /*count*/ 2
            + this._addresses.reduce((sum, address) => sum + address.serializedSize, 0);
    }

    /** @type {Array.<Address>} */
    get addresses() {
        return this._addresses;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }
}

/**
 * @type {number}
 */
GetAccountsProofMessage.ADDRESSES_MAX_COUNT = 256;
Class.register(GetAccountsProofMessage);
