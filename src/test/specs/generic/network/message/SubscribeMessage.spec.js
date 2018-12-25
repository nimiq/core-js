describe('SubscribeMessage', () => {
    const address1 = Address.fromBase64(Dummy.address1);
    const address2 = Address.fromBase64(Dummy.address2);
    const address3 = Address.fromBase64(Dummy.address3);
    const address4 = Address.fromBase64(Dummy.address4);
    const addresses = [address1, address2, address3, address4];
    const subscription = Subscription.fromAddresses(addresses);

    it('is serializable and unserializable', () => {
        const msg1 = new SubscribeMessage(subscription);
        const msg2 = SubscribeMessage.unserialize(msg1.serialize());

        expect(msg2.subscription.addresses.length).toEqual(addresses.length);
        expect(msg2.subscription.addresses[0].equals(address1)).toBe(true);
        expect(msg2.subscription.addresses[1].equals(address2)).toBe(true);
        expect(msg2.subscription.addresses[2].equals(address3)).toBe(true);
        expect(msg2.subscription.addresses[3].equals(address4)).toBe(true);
    });
});
