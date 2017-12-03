describe('Signature', () => {

    it('is 64 bytes long', () => {
        const signature1 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

        expect(signature1.serializedSize).toEqual(64);

        expect(() => {
            const sign = new Signature(new Uint8Array(16));
        }).toThrow('Primitive: Invalid length');

        expect(() => {
            const sign = new Signature('wrong test string');
        }).toThrow('Primitive: Invalid type');

        expect(() => {
            const sign = new Signature(new Uint8Array(65));
        }).toThrow('Primitive: Invalid length');
    });

    it('has an equals method', () => {
        const signature1 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
        const signature2 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature2));

        expect(signature1.equals(signature1)).toEqual(true);
        expect(signature2.equals(signature2)).toEqual(true);
        expect(signature1.equals(signature2)).toEqual(false);
        expect(signature1.equals(null)).toEqual(false);
        expect(signature1.equals(1)).toEqual(false);
    });


    it('is serializable and unserializable', () => {
        const signature1 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
        const signature2 = Signature.unserialize(signature1.serialize());

        expect(signature2.toBase64()).toEqual(Dummy.signature1);
        expect(signature2.toBase64()).toEqual(Dummy.signature1);
    });

    it('can be used to sign and verify with a given public key', (done) => {
        (async function () {
            const keyPair = await KeyPair.generate();
            const data = new Uint8Array([1, 2, 3, 4, 5, 6]);
            const signature = await Signature.create(keyPair.privateKey, keyPair.publicKey, data);
            expect(await signature.verify(keyPair.publicKey, data)).toBe(true);
            done();
        })();
    });
});
