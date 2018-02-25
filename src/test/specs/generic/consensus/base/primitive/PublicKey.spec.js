describe('PublicKey', () => {

    it('is serializable and unserializable', () => {
        const pubKey1 = KeyPair.generate().publicKey;
        const pubKey2 = PublicKey.unserialize(pubKey1.serialize());

        expect(pubKey1.equals(pubKey2)).toEqual(true);
        expect(pubKey1.serialize().byteLength).toEqual(pubKey1.serializedSize);
        expect(pubKey2.serialize().byteLength).toEqual(pubKey2.serializedSize);
    });

    it('has an equals method', () => {
        const pubKey1 = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
        const pubKey2 = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey2));
        const pubKey3 = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey2));

        expect(pubKey1.equals(1)).toEqual(false);
        expect(pubKey1.equals(null)).toEqual(false);
        expect(pubKey1.equals(pubKey1)).toEqual(true);
        expect(pubKey1.equals(pubKey2)).toEqual(false);
        expect(pubKey2.equals(pubKey3)).toEqual(true);
    });

    it('can sum up public keys', () => {
        const pubKey1 = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
        const pubKey2 = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey2));
        const pubKey3 = PublicKey.unserialize(BufferUtils.fromBase64('gJIjyS65kczX3eYvkw+Gd1bH7OQGBYvRJc2cx0pJd2k='));

        expect(PublicKey.sum([pubKey1, pubKey2]).equals(pubKey3)).toEqual(true);
        expect(PublicKey.sum([pubKey2, pubKey1]).equals(pubKey3)).toEqual(true);
    });

    it('correctly derives the public key', (done) => {
        (async function () {
            for (const testCase of Dummy.partialSignatureTestVectors) {
                for (let i = 0; i < testCase.pubKeys.length; ++i) {
                    const pubKey = PublicKey._publicKeyDerive(testCase.privKeys[i]);
                    expect(BufferUtils.equals(pubKey, testCase.pubKeys[i])).toBe(true);
                }
            }
        })().then(done, done.fail);
    });

    it('correctly computes public keys hash', (done) => {
        (async function () {
            for (const testCase of Dummy.partialSignatureTestVectors) {
                const publicKeysHash = PublicKey._publicKeysHash(testCase.pubKeys);
                expect(BufferUtils.equals(publicKeysHash, testCase.pubKeysHash)).toBe(true);
            }
        })().then(done, done.fail);
    });

    it('correctly derives the delinearized public key', (done) => {
        (async function () {
            for (const testCase of Dummy.partialSignatureTestVectors) {
                for (let i = 0; i < testCase.pubKeys.length; ++i) {
                    const publicKeysHash = PublicKey._publicKeysHash(testCase.pubKeys);
                    const delinearizedPubKey = PublicKey._publicKeyDelinearize(testCase.pubKeys[i], publicKeysHash);
                    expect(BufferUtils.equals(delinearizedPubKey, testCase.delinearizedPubKeys[i])).toBe(true);
                }
            }
        })().then(done, done.fail);
    });

    it('correctly aggregates and delinearizes public keys', (done) => {
        (async function () {
            for (const testCase of Dummy.partialSignatureTestVectors) {
                const publicKeysHash = PublicKey._publicKeysHash(testCase.pubKeys);
                const delinearizedPubKeys = [];
                for (let i = 0; i < testCase.pubKeys.length; ++i) { // TODO why is this even computed
                    const delinearizedPubKey = PublicKey._publicKeyDelinearize(testCase.pubKeys[i], publicKeysHash);
                    delinearizedPubKeys.push(delinearizedPubKey);
                }
                const aggregatePubKey = PublicKey._publicKeysDelinearizeAndAggregate(testCase.pubKeys, publicKeysHash);
                expect(BufferUtils.equals(aggregatePubKey, testCase.aggPubKey)).toBe(true);
            }
        })().then(done, done.fail);
    });
});
