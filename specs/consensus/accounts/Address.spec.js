describe('Address', () => {

    it('is 20 bytes long', () => {
        const address = new Address(Dummy.address1);
        expect(address.serializedSize).toEqual(20);
        expect(() => {
            const sign = new Address(new ArrayBuffer(16));
        }).toThrow('Invalid argument');

        expect(() => {
            const sign = new Address('test');
        }).toThrow('Invalid argument');

        expect(() => {
            const sign = new Address(new ArrayBuffer(33));
        }).toThrow('Invalid argument');
    });

    it('has an equals method', () => {
        const address1 = new Address(Dummy.address1);
        const address2 = new Address(Dummy.address2);

        expect(address1.equals(address1))
            .toBe(true,'because address1 == address1');
        expect(address1.equals(address2))
            .toBe(false,'because address1 !== address2');
        expect(address1.equals(null))
            .toBe(false,'because address1 !== null');
        expect(address1.equals(1))
            .toBe(false,'because address1 !== 1');
    });

    it('is serializable and unserializable', () => {
    	const address1 = new Address(Dummy.address1);
    	const address2 = Address.unserialize(address1.serialize());

		expect(address2.toBase64()).toBe(Dummy.address1,'because of invariance.');
    });
});
