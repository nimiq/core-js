class ProofUtils {

    /**
     * @param {Transaction} transaction
     * @param {Uint8Array} [proof]
     * @param {Address} [sender]
     * @param {Uint8Array} [content]
     * @return {Promise.<boolean>}
     */
    static async verifySignatureProof(transaction, proof = transaction.proof, sender = transaction.sender, content = transaction.serializeContent()) {
        const buf = new SerialBuffer(proof);
        const merkleTreeDepth = buf.readUint8();
        const pubkey = PublicKey.unserialize(buf);
        let hash = await pubkey.hash();

        for (let i = 0; i < merkleTreeDepth; ++i) {
            const left = buf.readUint8();
            const inner = buf.read(Crypto.hashSize);
            const concat = new SerialBuffer(inner.serializedSize * 2);
            if (left) concat.write(inner);
            hash.serialize(concat);
            if (!left) concat.write(inner);
            hash = await Hash.light(concat);
        }

        if (!sender.equals(new Address(hash.subarray(0, 20)))) {
            Log.w(ProofUtils, 'Invalid Transaction - signer does not match address', transaction);
            return false;
        }

        const sig = Signature.unserialize(buf);
        return sig.verify(pubkey, content);
    }
}

Class.register(ProofUtils);
