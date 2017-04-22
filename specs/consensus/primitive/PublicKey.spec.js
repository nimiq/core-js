describe('PublicKey', () => {

    it('is 65 bytes long (for now, because of WebCrypto API)', () => {
        // See: https://w3c.github.io/webcrypto/Overview.html#subtlecrypto-interface-datatypes

        const pubKey1 = new PublicKey(Dummy.publicKey1);
        expect(pubKey1.serializedSize).toEqual(65);
        expect(() => {
            const pubKey = new PublicKey(new ArrayBuffer(16));
        }).toThrow('Invalid argument');

        expect(() => {
            const pubKey = new PublicKey(new ArrayBuffer(20));
        }).toThrow('Invalid argument');

        expect(() => {
            const pubKey = new PublicKey(new ArrayBuffer(66));
        }).toThrow('Invalid argument');

        expect(() => {
            const pubKey = new PublicKey(new ArrayBuffer(64));
        }).toThrow('Invalid argument');
    });
    
    it('has an equals method', () => {
        const pubKey1 = new PublicKey(Dummy.publicKey1);
        const pubKey2 = new PublicKey(Dummy.publicKey2);
        const pubKey3 = new PublicKey(Dummy.publicKey2);

        expect(pubKey1.equals(1)).toEqual(false);
        expect(pubKey1.equals(null)).toEqual(false);
        expect(pubKey1.equals(pubKey1)).toEqual(true);
        expect(pubKey1.equals(pubKey2)).toEqual(false);
        expect(pubKey2.equals(pubKey3)).toEqual(true);
    });


    it('is serializable and unserializable', () => {
    	const pubKey1 = new PublicKey();
    	const pubKey2 = PublicKey.unserialize(pubKey1.serialize());

		expect(pubKey1.equals(pubKey2)).toEqual(true);
    });
});
