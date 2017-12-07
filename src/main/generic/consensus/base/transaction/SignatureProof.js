class SignatureProof {
    constructor(signature, publicKey, proof) {
        this._signature = signature;
        this._publicKey = publicKey;
        this._proof = proof;
    }

    static async fromHashes(signature, publicKey, hashes) {
        const hash = await publicKey.hash();
        const proof = [];
        await SignatureProof._computeProof(hashes, hash, proof);
        return new SignatureProof(signature, publicKey, proof);
    }

    /**
     * @param {Array.<Hash>} hashes
     * @param {Hash} leaf
     * @param {Array.<{left:boolean, inner:Hash}>} proof
     * @return {{containsLeaf:boolean, inner:Hash}}
     * @private
     */
    static async _computeProof(hashes, leaf, proof) {
        const len = hashes.length;
        let hash;
        if (len === 0) {
            hash = await Hash.light(new Uint8Array(0));
            return {containsLeaf: false, inner: hash};
        }
        if (len === 1) {
            hash = hashes[0];
            return {containsLeaf: hash.equals(leaf), inner: hash};
        }

        const mid = Math.round(len / 2);
        const left = hashes.slice(0, mid);
        const right = hashes.slice(mid);
        const {containsLeaf: leftLeaf, inner: leftHash} = await SignatureProof._computeProof(left, leaf, proof);
        const {containsLeaf: rightLeaf, inner: rightHash} = await SignatureProof._computeProof(right, leaf, proof);
        hash = await Hash.light(BufferUtils.concatTypedArrays(leftHash.serialize(), rightHash.serialize()));

        if (leftLeaf) {
            proof.push({left: false, inner: rightHash});
            return {containsLeaf: true, inner: hash};
        } else if (rightLeaf) {
            proof.push({left: true, inner: leftHash});
            return {containsLeaf: true, inner: hash};
        }
        return {containsLeaf: false, inner: hash};
    }

    /**
     * @param {SerialBuffer} buf
     * @return {SignatureProof}
     */
    static unserialize(buf) {
        const merkleTreeDepth = buf.readUint8();
        const publicKey = PublicKey.unserialize(buf);

        const proof = [];
        for (let i = 0; i < merkleTreeDepth; ++i) {
            const left = buf.readUint8();
            const inner = Hash.unserialize(buf);
            proof.push({left: !!left, inner});
        }

        const sig = Signature.unserialize(buf);
        return new SignatureProof(sig, publicKey, proof);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._proof.length);
        this._publicKey.serialize(buf);
        for (const node of this._proof) {
            buf.writeUint8(node.left ? 1 : 0);
            node.inner.serialize(buf);
        }
        this._signature.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*proof length*/ 1
            + this._publicKey.serializedSize
            + /*left*/ this._proof.length
            + /*hashes*/ this._proof.reduce((acc, hash) => acc + hash.serializedSize, 0)
            + this._signature.serializedSize;
    }

    /**
     * @param {SignatureProof} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof SignatureProof
            && this._publicKey.equals(o._publicKey)
            && this._proof.length === o._proof.length
            && this._proof.every((node, i) => node.left === o._proof[i].left && node.inner.equals(o._proof[i].inner))
            && this._signature.equals(o._signature);
    }

    static async verifySignatureProof(transaction, proof = transaction.proof, sender = transaction.sender, content = transaction.serializeContent()) {
        return SignatureProof.unserialize(new SerialBuffer(proof)).verify(transaction, sender, content);
    }

    /**
     * @param {Transaction} transaction
     * @param {Address} [sender]
     * @param {Uint8Array} [content]
     * @return {Promise.<boolean>}
     */
    async verify(transaction, sender = transaction.sender, content = transaction.serializeContent()) {
        let hash = await this._publicKey.hash();

        for (let i = 0; i < this._proof.length; ++i) {
            const left = this._proof[i].left;
            const inner = this._proof[i].inner;
            const concat = new SerialBuffer(inner.serializedSize * 2);
            if (left) inner.serialize(concat);
            hash.serialize(concat);
            if (!left) inner.serialize(concat);
            hash = await Hash.light(concat);
        }

        if (!sender.equals(new Address(hash.subarray(0, 20)))) {
            Log.w(SignatureProof, 'Invalid Transaction - signer does not match address', transaction);
            return false;
        }

        return this._signature.verify(this._publicKey, content);
    }
}

Class.register(SignatureProof);
