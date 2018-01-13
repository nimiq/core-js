describe('Address', () => {
    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('is 20 bytes long', () => {
        const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        expect(address.serializedSize).toEqual(20);
        expect(() => {
            const sign = new Address(new Uint8Array(16));
        }).toThrow(new Error('Primitive: Invalid length'));

        expect(() => {
            const sign = new Address('test');
        }).toThrow(new Error('Primitive: Invalid type'));

        expect(() => {
            const sign = new Address(new Uint8Array(33));
        }).toThrow(new Error('Primitive: Invalid length'));
    });

    it('is serializable and unserializable', () => {
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        const address2 = Address.unserialize(address1.serialize());

        expect(address2.toBase64()).toBe(Dummy.address1);
    });

    it('has an equals method', () => {
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        expect(address1.equals(address1))
            .toBe(true, 'because address1 == address1');
        expect(address1.equals(address2))
            .toBe(false, 'because address1 !== address2');
        expect(address1.equals(null))
            .toBe(false, 'because address1 !== null');
        expect(address1.equals(1))
            .toBe(false, 'because address1 !== 1');
    });

    it('can create and parse user-friendly address', () => {
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        const address2 = Address.fromUserFriendlyAddress(address1.toUserFriendlyAddress());
        const address3 = Address.fromUserFriendlyAddress(address1.toUserFriendlyAddress(false));
        expect(address2).toEqual(address1);
        expect(address3).toEqual(address1);
    });

    it('can detect invalid user-friendly address', () => {
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        const string = address1.toUserFriendlyAddress().replace('0', '1');
        expect(() => Address.fromUserFriendlyAddress(string)).toThrow();
        expect(() => Address.fromUserFriendlyAddress('DE02120300000000202051')).toThrow();
    });

    it('iban check can verify actual valid iban', () => {
        expect(Address._ibanCheck('120300000000202051DE02')).toBe(1);
    });
});
