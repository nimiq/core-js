class PublicKey extends Primitive {
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
        super(arg, Uint8Array, PublicKey.SIZE);
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
        const publicKeysObj = publicKeys.map(key => key._obj);
        const publicKeysHash = Crypto.workerSync().publicKeysHash(publicKeysObj);
        const raw = Crypto.workerSync().publicKeysDelinearizeAndAggregate(publicKeysObj, publicKeysHash);
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
     * @param {Primitive} o
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
}

PublicKey.SIZE = 32;

Class.register(PublicKey);
