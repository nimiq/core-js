describe('Address', () => {

    it('is 20 bytes long', () => {
        const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        expect(address.serializedSize).toEqual(20);
        expect(() => {
            const sign = new Address(new Uint8Array(16));
        }).toThrow('Primitive: Invalid length');

        expect(() => {
            const sign = new Address('test');
        }).toThrow('Primitive: Invalid type');

        expect(() => {
            const sign = new Address(new Uint8Array(33));
        }).toThrow('Primitive: Invalid length');
    });

    it('is serializable and unserializable', () => {
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        const address2 = Address.unserialize(address1.serialize());

        expect(address2.toBase64()).toBe(Dummy.address1,'because of invariance.');
    });

    it('has an equals method', () => {
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        expect(address1.equals(address1))
            .toBe(true,'because address1 == address1');
        expect(address1.equals(address2))
            .toBe(false,'because address1 !== address2');
        expect(address1.equals(null))
            .toBe(false,'because address1 !== null');
        expect(address1.equals(1))
            .toBe(false,'because address1 !== 1');
    });
});
