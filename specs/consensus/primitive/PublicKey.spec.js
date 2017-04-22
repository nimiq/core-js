describe('PublicKey', () => {

    it('has an equals method', () => {
        const pubKey1 = new PublicKey('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElkXTkPlmJZuhioJshJIq+xnhhv0t918CIzhc/Ei1RpIJp1ZsKAXZfzhaJIYlpc5AEXm+5xKI6dsEfXMJDbJA4g==');
        const pubKey2 = new PublicKey();

        expect(pubKey1.equals(pubKey1)).toEqual(true);
        expect(pubKey1.equals(pubKey2)).toEqual(false);
        expect(pubKey1.equals(null)).toEqual(false);
        expect(pubKey1.equals(1)).toEqual(false);
    });

    it('must be 65 bytes long (for now, because of WebCrypto API)', () => {
        pubKey1 = new PublicKey()
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

    it('is serializable and unserializable', () => {
    	const pubKey1 = new PublicKey();
    	const pubKey2 = PublicKey.unserialize(pubKey1.serialize());

		expect(pubKey1.equals(pubKey2)).toEqual(true);
    });
});
