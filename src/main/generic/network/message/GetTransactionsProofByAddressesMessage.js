class GetTransactionsProofByAddressesMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     */
    constructor(blockHash, addresses) {
        super(Message.Type.GET_TRANSACTIONS_PROOF_BY_ADDRESSES);
        if (!blockHash || !(blockHash instanceof Hash)) throw new Error('Malformed block hash');
        if (!Array.isArray(addresses) || !NumberUtils.isUint16(addresses.length)
            || addresses.length > GetTransactionsProofByAddressesMessage.ADDRESSES_MAX_COUNT
            || addresses.some(it => !(it instanceof Address))) throw new Error('Malformed addresses');
        this._blockHash = blockHash;
        /** @type {Array.<Address>} */
        this._addresses = addresses;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetTransactionsProofByAddressesMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const count = buf.readUint16();
        if (count > GetTransactionsProofByAddressesMessage.ADDRESSES_MAX_COUNT) throw new Error('Malformed count');
        const addresses = new Array(count);
        for (let i = 0; i < count; i++) {
            addresses[i] = Address.unserialize(buf);
        }
        return new GetTransactionsProofByAddressesMessage(blockHash, addresses);
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
GetTransactionsProofByAddressesMessage.ADDRESSES_MAX_COUNT = 255;
Class.register(GetTransactionsProofByAddressesMessage);
