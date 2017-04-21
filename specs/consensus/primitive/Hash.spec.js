describe('Hash', () => {

    it('has an equals method', () => {
        const hash1 = new Hash(Dummy.hash1);
        const hash2 = new Hash(Dummy.hash2);

        expect(hash1.equals(hash1))
            .toBe(true,'because hash1 == hash1');
        expect(hash1.equals(hash2))
            .toBe(false,'because hash1 !== hash2');
        expect(hash1.equals(null))
            .toBe(false,'because hash1 !== null');
        expect(hash1.equals(1))
            .toBe(false,'because hash1 !== 1');
    });

    it('must be 32bytes long', () => {
        const hash = new Hash(Dummy.hash1);
        expect(hash.serializedSize).toEqual(32);
        expect(() => { 
            const sign = new Hash(new ArrayBuffer(16)); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new Hash('test'); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new Hash(new ArrayBuffer(33)); 
        }).toThrow('Invalid argument');
    });

    it('is serializable and unserializable', () => {
    	const hash1 = new Hash(Dummy.hash1);
    	const hash2 = Hash.unserialize(hash1.serialize());

		expect(hash2.toBase64()).toBe(Dummy.hash1,'because of invariance.');
    }); 
});