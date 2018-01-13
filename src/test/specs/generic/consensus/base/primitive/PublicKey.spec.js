describe('PublicKey', () => {
    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

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
        const pubKey3 = PublicKey.unserialize(BufferUtils.fromBase64('NbjmhKskNEbYSWstfxlwosvWdcefOBmtnX8UxbIJUUo='));

        expect(PublicKey.sum([pubKey1, pubKey2]).equals(pubKey3)).toEqual(true);
        expect(PublicKey.sum([pubKey2, pubKey1]).equals(pubKey3)).toEqual(false);
    });
});
