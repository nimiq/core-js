class PublicKey extends Serializable {
    /**
     * @param {PublicKey} o
     * @returns {PublicKey}
     */
    static copy(o) {
        if (!o) return o;
        return new PublicKey(new Uint8Array(o._obj));
    }

    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== PublicKey.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * @param {PrivateKey} privateKey
     * @return {PublicKey}
     */
    static derive(privateKey) {
        return new PublicKey(Crypto.workerSync().publicKeyDerive(privateKey._obj));
    }

    /**
     * @param {Array.<PublicKey>} publicKeys
     * @return {PublicKey}
     */
    static sum(publicKeys) {
        publicKeys = publicKeys.slice();
        publicKeys.sort((a, b) => a.compare(b));
        const raw = PublicKey._delinearizeAndAggregatePublicKeys(publicKeys.map(k => k.serialize()));
        return new PublicKey(raw);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PublicKey}
     */
    static unserialize(buf) {
        return new PublicKey(buf.read(PublicKey.SIZE));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this._obj);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return PublicKey.SIZE;
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PublicKey && super.equals(o);
    }

    /**
     * @return {Hash}
     */
    hash() {
        return Hash.light(this.serialize());
    }

    /**
     * @return {Promise.<Hash>}
     */
    hashAsync() {
        return Hash.lightAsync(this.serialize());
    }

    /**
     * @param {PublicKey} o
     * @return {number}
     */
    compare(o) {
        return BufferUtils.compare(this._obj, o._obj);
    }

    /**
     * @return {Address}
     */
    toAddress() {
        return Address.fromHash(this.hash());
    }

    /**
     * @return {PeerId}
     */
    toPeerId() {
        return new PeerId(this.hash().subarray(0, 16));
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @returns {Uint8Array}
     */
    static _delinearizeAndAggregatePublicKeys(publicKeys) {
        const worker = Crypto.workerSync();
        const publicKeysHash = worker.publicKeysHash(publicKeys);
        return worker.publicKeysDelinearizeAndAggregate(publicKeys, publicKeysHash);
    }
}

PublicKey.SIZE = 32;

Class.register(PublicKey);
