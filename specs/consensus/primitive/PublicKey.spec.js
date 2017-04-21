describe('PublicKey', () => {

    it('has an equals method', () => {
        const pubKey1 = new PublicKey('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElkXTkPlmJZuhioJshJIq+xnhhv0t918CIzhc/Ei1RpIJp1ZsKAXZfzhaJIYlpc5AEXm+5xKI6dsEfXMJDbJA4g==');
        const pubKey2 = new PublicKey();

        expect(pubKey1.equals(pubKey1)).toEqual(true);
        expect(pubKey1.equals(pubKey2)).toEqual(false);
        expect(pubKey1.equals(null)).toEqual(false);
        expect(pubKey1.equals(1)).toEqual(false);
    });

    it('must be 64bytes long', () => {
        pubKey1 = new PublicKey()
        expect(pubKey1.serializedSize).toEqual(64);
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
    	const pubKey1 = new PublicKey();
    	const pubKey2 = PublicKey.unserialize(pubKey1.serialize());

		expect(pubKey1.equals(pubKey2)).toEqual(true);
    });
});
