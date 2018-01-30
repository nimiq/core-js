describe('BlockBody', () => {
    let signature, transaction1, transaction2, transaction3, transaction4, minerAddress;

    beforeAll(() => {
        signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

        transaction1 = new BasicTransaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);
        transaction2 = new BasicTransaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);
        transaction3 = new BasicTransaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);
        transaction4 = new BasicTransaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);

        minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    });

    it('is serializable and unserializable', () => {
        const blockBody1 = new BlockBody(minerAddress, [transaction1, transaction2], BufferUtils.fromAscii('Random'));
        const blockBody2 = BlockBody.unserialize(blockBody1.serialize());
        expect(BufferUtils.equals(blockBody1.serialize(), blockBody2.serialize())).toBe(true);
        expect(BufferUtils.equals(blockBody1.hash(), blockBody2.hash())).toBe(true);
        expect(BufferUtils.equals(blockBody1.extraData, blockBody2.extraData)).toBe(true);
    });

    it('has well-defined transactions', () => {
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

    it('has well-ordered transactions', (done) => {
        const sortedTransactions = [transaction1, transaction2, transaction3, transaction4];
        sortedTransactions.sort((a, b) => a.compareBlockOrder(b));
        const blockBody1 = new BlockBody(minerAddress, [
            sortedTransactions[0], sortedTransactions[2], sortedTransactions[1], sortedTransactions[3]]);

        (async () => {
            expect(await blockBody1.verify()).toBe(false);
        })().then(done, done.fail);
    });

    it('rejects duplicate transactions', (done) => {
        const blockBody1 = new BlockBody(minerAddress, [transaction1, transaction1]);
        (async () => {
            expect(await blockBody1.verify()).toBe(false);
        })().then(done, done.fail);
    });
});
