class Entropy extends Serializable {
    /**
     * @param {Uint8Array} arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== Entropy.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * @return {Entropy}
     */
    static generate() {
        const entropy = new Uint8Array(Entropy.SIZE);
        CryptoWorker.lib.getRandomValues(entropy);
        return new Entropy(entropy);
    }

    /**
     * @param {string} [password]
     * @param {Array.<string>} [wordlist]
     * @return {ExtendedPrivateKey}
     */
    toExtendedPrivateKey(password, wordlist) {
        return MnemonicUtils.mnemonicToExtendedPrivateKey(this.toMnemonic(wordlist), password);
    }

    /**
     * @param {Array.<string>} [wordlist]
     * @return {Array.<string>}
     */
    toMnemonic(wordlist) {
        return MnemonicUtils.entropyToMnemonic(this, wordlist);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Entropy}
     */
    static unserialize(buf) {
        return new Entropy(buf.read(Entropy.SIZE));
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
        return Entropy.SIZE;
    }

    /**
     * Overwrite this entropy with a replacement in-memory
     * @param {Entropy} entropy
     */
    overwrite(entropy) {
        this._obj.set(entropy._obj);
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Entropy && super.equals(o);
    }
}

Entropy.SIZE = 32;

Class.register(Entropy);
