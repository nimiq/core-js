describe('Hash', () => {

    it('has an equals method', () => {
        const signature1 = new Hash();
        const signature2 = new Hash();

        expect(signature1.equals(signature1)).toEqual(true);
        expect(signature1.equals(signature2)).toEqual(false);
        expect(signature1.equals(null)).toEqual(false);
        expect(signature1.equals(1)).toEqual(false);
    });

    it('must be 32bytes long', () => {
        signature1 = new Hash()
        expect(signature1.serializedSize).toEqual(32);
        expect(() => { 
            const sign = new Hash(new ArrayBuffer(16)); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new Hash('asd'); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new Hash(new ArrayBuffer(33)); 
        }).toThrow('Invalid argument');
    });

    it('is serializable and unserializable', () => {
    	const signature1 = new Hash();
    	const signature2 = Hash.unserialize(signature1.serialize());

		expect(signature1.equals(signature2)).toEqual(true);
    }); 
});