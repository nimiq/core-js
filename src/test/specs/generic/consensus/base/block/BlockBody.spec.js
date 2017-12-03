describe('BlockBody', () => {
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

    const transaction1 = new Transaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);
    const transaction2 = new Transaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);
    const transaction3 = new Transaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);
    const transaction4 = new Transaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);

    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

    // Note: This test is now useless as hash() returns a Hash object which verifies its size
    it('has a 32 byte bodyHash', (done) => {
        const blockBody1 = new BlockBody(minerAddress, [
            transaction1, transaction2, transaction3, transaction4,
            transaction1, transaction2, transaction3, transaction4,
            transaction1, transaction2, transaction3, transaction4]);

        (async () => {
            const bodyHash = await blockBody1.hash();
            expect(bodyHash.serialize().byteLength).toBe(32);
        })().then(done, done.fail);
    });

    it('is serializable and unserializable', (done) => {
        (async () => {
            const blockBody1 = new BlockBody(minerAddress, [transaction1, transaction2], BufferUtils.fromAscii('Random'));
            const blockBody2 = BlockBody.unserialize(blockBody1.serialize());
            expect(BufferUtils.equals(blockBody1, blockBody2)).toBe(true);
            expect(BufferUtils.equals(await blockBody1.hash(), await blockBody2.hash())).toBe(true);
            expect(BufferUtils.equals(blockBody1.extraData, blockBody2.extraData)).toBe(true);
        })().then(done, done.fail);
    });

    it('transactions must be well defined', () => {
        /* eslint-disable no-unused-vars */
        expect(() => {
            const test1 = new BlockBody(minerAddress, null);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test2 = new BlockBody(minerAddress, undefined);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test3 = new BlockBody(minerAddress, [null]);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test4 = new BlockBody(minerAddress, [undefined]);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test5 = new BlockBody(minerAddress, [true]);
        }).toThrow('Malformed transactions');
        /* eslint-enable no-unused-vars */
    });
});
