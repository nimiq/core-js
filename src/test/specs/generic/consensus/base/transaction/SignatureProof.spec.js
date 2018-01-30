describe('SignatureProof', () => {
    it('can create and verify a signature proof', (done) => {
        (async function () {
            const data = BufferUtils.fromAscii('test message');
            const keyPair = await KeyPair.generate();
            const publicKeys = [keyPair.publicKey];
            for (let i = 0; i < 6; ++i) {
                publicKeys.push((await KeyPair.generate()).publicKey);
            }

            for (let i = 1; i < 6; ++i) {
                const address = Address.fromHash(MerkleTree.computeRoot(publicKeys.slice(0, i)));
                const relevantKeys = publicKeys.slice(0, i);

                const sig = await Signature.create(keyPair.privateKey, keyPair.publicKey, data);
                const proof = SignatureProof.multiSig(keyPair.publicKey, relevantKeys, sig);

                expect(await proof.verify(address, data)).toBe(true, `Verification failed ${i}`);
                expect(SignatureProof.unserialize(proof.serialize()).equals(proof)).toBe(true, `Serialization failed ${i}`);
            }
        })().then(done, done.fail);
    });
});
