describe('Signature', () => {

    it('is 64 bytes long', () => {
        const signature1 = new Signature(Dummy.signature1);

        expect(signature1.serializedSize).toEqual(64);

        expect(() => {
            const sign = new Signature(new ArrayBuffer(16));
        }).toThrow('Primitive: Invalid length');

        expect(() => {
            const sign = new Signature('wrong test string');
        }).toThrow('Primitive: Invalid length');

        expect(() => {
            const sign = new Signature(new ArrayBuffer(65));
        }).toThrow('Primitive: Invalid length');
    });

    it('has an equals method', () => {
        const signature1 = new Signature(Dummy.signature1);
        const signature2 = new Signature(Dummy.signature2);

        expect(signature1.equals(signature1)).toEqual(true);
        expect(signature2.equals(signature2)).toEqual(true);
        expect(signature1.equals(signature2)).toEqual(false);
        expect(signature1.equals(null)).toEqual(false);
        expect(signature1.equals(1)).toEqual(false);
    });


    it('is serializable and unserializable', () => {
    	const signature1 = new Signature(Dummy.signature1);
    	const signature2 = Signature.unserialize(signature1.serialize());

        expect(signature2.toBase64()).toEqual(Dummy.signature1);
		expect(signature2.toBase64()).toEqual(Dummy.signature1);
    });
});
