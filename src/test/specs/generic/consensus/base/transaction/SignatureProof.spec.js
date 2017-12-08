describe('SignatureProof', () => {
    it('can create and verify a signature proof', (done) => {
        (async function () {
            const data = BufferUtils.fromAscii('test message');
            const keyPair = await KeyPair.generate();
            const publicKeys = [keyPair.publicKey];
            for (let i=0; i<6; ++i) {
                publicKeys.push((await KeyPair.generate()).publicKey);
            }
            const hashes = await Promise.all(publicKeys.map(key => key.hash()));

            for (let i=1; i<6; ++i) {
                const address = new Address((await MerkleTree.computeRoot(publicKeys.slice(0, i), key => Hash.light(key.serialize()))).subarray(0, 20));
                const relevantHashes = hashes.slice(0, i);

                const sig = await Signature.create(keyPair.privateKey, keyPair.publicKey, data);
                const proof = await SignatureProof.fromHashes(sig, keyPair.publicKey, relevantHashes);

                expect(await proof.verify(null, address, data)).toBe(true, `Verification failed ${i}`);
                expect(SignatureProof.unserialize(proof.serialize()).equals(proof)).toBe(true, `Serialization failed ${i}`);
            }
        })().then(done, done.fail);
    });
});
