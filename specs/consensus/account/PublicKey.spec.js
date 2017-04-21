describe('PublicKey', () => {

    it('has an equals method', () => {
        const signature1 = new PublicKey();
        const signature2 = new PublicKey();

        expect(signature1.equals(signature1)).toEqual(true);
        expect(signature1.equals(signature2)).toEqual(false);
        expect(signature1.equals(null)).toEqual(false);
        expect(signature1.equals(1)).toEqual(false);
    });

    it('must be 64bytes long', () => {
        signature1 = new PublicKey()
        expect(signature1.serializedSize).toEqual(64);
        expect(() => { 
            const sign = new PublicKey(new ArrayBuffer(16)); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new PublicKey('asd'); 
        }).toThrow('Invalid argument');

        expect(() => { 
            const sign = new PublicKey(new ArrayBuffer(65)); 
        }).toThrow('Invalid argument');
    });

    it('is serializable and unserializable', () => {
    	const signature1 = new PublicKey();
    	const signature2 = PublicKey.unserialize(signature1.serialize());

		expect(signature1.equals(signature2)).toEqual(true);
    }); 
});