describe('Signature', () => {

    it('has an equals method', () => {
        const signature1 = new Signature();
        const signature2 = new Signature();

        expect(signature1.equals(signature1)).toEqual(true);
        expect(signature1.equals(signature2)).toEqual(false);
        expect(signature1.equals(null)).toEqual(false);
        expect(signature1.equals(1)).toEqual(false);
    });

    it('must be 64bytes long', () => {

        expect(() => { 
            const sign = new Signature(new ArrayBuffer(16)); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new Signature('asd'); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new Signature(new ArrayBuffer(65)); 
        }).toThrow('Invalid argument');
    });

    it('is serializable and unserializable', () => {
    	const signature1 = new Signature();
    	const signature2 = Signature.unserialize(signature1.serialize());

		expect(signature1.equals(signature2)).toEqual(true);
    }); 
});