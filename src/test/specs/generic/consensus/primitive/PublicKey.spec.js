describe('PublicKey', () => {

    it('is serializable and unserializable', (done) => {
        (async function () {
            const pubKey1 = (await KeyPair.generate()).publicKey;
            const pubKey2 = PublicKey.unserialize(pubKey1.serialize());

            expect(pubKey1.equals(pubKey2)).toEqual(true);
            expect(pubKey1.serialize().byteLength).toEqual(pubKey1.serializedSize);
            expect(pubKey2.serialize().byteLength).toEqual(pubKey2.serializedSize);
            done();
        })();
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
});
