describe('Hash', () => {

    it('has an equals method', () => {
        const hash = new Hash();
        const signature2 = new Hash();

        expect(hash.equals(hash)).toEqual(true);
        expect(hash.equals(signature2)).toEqual(false);
        expect(hash.equals(null)).toEqual(false);
        expect(hash.equals(1)).toEqual(false);
    });

    it('must be 32bytes long', () => {
        hash = new Hash()
        expect(hash.serializedSize).toEqual(32);
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
    	const hash = new Hash();
    	const signature2 = Hash.unserialize(hash.serialize());

		expect(hash.equals(signature2)).toEqual(true);
    }); 
});