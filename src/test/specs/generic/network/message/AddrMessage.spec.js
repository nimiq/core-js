describe('AddrMessage', () => {
    const addr = new DumbPeerAddress(0, 0, new NetAddress('127.0.0.1'), PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), 0, Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1)));

    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('is correctly constructed', () => {
        const msg1 = new AddrMessage([addr]);

        expect(msg1.addresses.length).toBe(1);
        expect(msg1.addresses[0].equals(addr)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new AddrMessage([addr]);
        const msg2 = AddrMessage.unserialize(msg1.serialize());

        expect(msg2.addresses.length).toBe(msg1.addresses.length);
        expect(msg2.addresses.every((addr, i) => msg1.addresses[i].equals(addr))).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new AddrMessage()).toThrow();
        expect(() => new AddrMessage('abc')).toThrow();
        expect(() => new AddrMessage([null])).toThrow();
    });
});
