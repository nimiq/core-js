describe('Primitive', () => {

    it('has an equals method', () => {
        const primitive1 = new Primitive(Dummy.hash1);
        const primitive2 = new Primitive(Dummy.hash2);

        expect(primitive1.equals(primitive1))
            .toBe(true,'because primitive1 == primitive1');
        expect(primitive1.equals(primitive2))
            .toBe(false,'because primitive1 !== primitive2');
        expect(primitive1.equals(null))
            .toBe(false,'because primitive1 !== null');
        expect(primitive1.equals(1))
            .toBe(false,'because primitive1 !== 1');
    });

    it('has a toBase64 method', () => {
        const primitive1 = new Primitive(Dummy.hash1);

        expect(primitive1.toBase64())
            .toBe(Dummy.hash1,'because it was initalized with this base64 string');
    });

    it('is serializable and unserializable', () => {
    	const primitive1 = new Primitive(Dummy.hash1);
    	const primitive2 = Primitive.unserialize(primitive1.serialize());

		expect(primitive2.toBase64()).toBe(Dummy.primitive1,'because of invariance.');
    }); 
});