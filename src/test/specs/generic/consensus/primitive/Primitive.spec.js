describe('Primitive', () => {

    it('has an equals method', () => {
        const primitive1 = new Primitive(Dummy.hash1);
        primitive1.serialize = () => BufferUtils.fromBase64(Dummy.hash1);
        const primitive2 = new Primitive(Dummy.hash2);
        primitive2.serialize = () => BufferUtils.fromBase64(Dummy.hash2);

        expect(primitive1.equals(primitive1))
            .toBe(true, 'because primitive1 == primitive1');
        expect(primitive1.equals(primitive2))
            .toBe(false, 'because primitive1 !== primitive2');
        expect(primitive1.equals(null))
            .toBe(false, 'because primitive1 !== null');
        expect(primitive1.equals(1))
            .toBe(false, 'because primitive1 !== 1');
    });

    it('has a toBase64 method', () => {
        const primitive1 = new Primitive(Dummy.hash1);
        primitive1.serialize = () => BufferUtils.fromBase64(Dummy.hash1);

        expect(primitive1.toBase64())
            .toBe(Dummy.hash1, 'because it was initalized with this base64 string');
    });
});
