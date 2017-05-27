describe('BlockBody', () => {
    const signature = new Signature(Dummy.signature1);

    const transaction1 = new Transaction(new PublicKey(Dummy.publicKey1), new Address(Dummy.address1), 8888, 42, 0, signature);
    const transaction2 = new Transaction(new PublicKey(Dummy.publicKey1), new Address(Dummy.address1), 8888, 42, 0, signature);
    const transaction3 = new Transaction(new PublicKey(Dummy.publicKey1), new Address(Dummy.address1), 8888, 42, 0, signature);
    const transaction4 = new Transaction(new PublicKey(Dummy.publicKey1), new Address(Dummy.address1), 8888, 42, 0, signature);

    const minerAddress = new Address(Dummy.address1);

    it('has a 32 byte bodyHash', (done) => {
        const blockBody1 = new BlockBody(minerAddress, [
            transaction1, transaction2, transaction3, transaction4,
            transaction1, transaction2, transaction3, transaction4,
            transaction1, transaction2, transaction3, transaction4]);

        async function test() {
            const bodyHash = await blockBody1.hash();
            expect(bodyHash.byteLength).toBe(32);
            done();
        }

        test();
    });

    it('is serializable and unserializable', () => {
        const blockBody1 = new BlockBody(minerAddress, [transaction1, transaction2, transaction3, transaction4]);
        const blockBody2 = BlockBody.unserialize(blockBody1.serialize());
        expect(BufferUtils.equals(blockBody1, blockBody2)).toBe(true);
    });

    it('transactions must be well defined', () => {
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
    });
});
