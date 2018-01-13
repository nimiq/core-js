describe('MempoolTransactionSet', () => {
    let tx1, tx2, tx3;

    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();

            const users = TestBlockchain.getUsers(2);
            tx1 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 2000, 5, 1, users[0].privateKey);
            tx2 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1000, 500, 1, users[0].privateKey);
            tx3 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 3000, 500, 2, users[0].privateKey);
        })().then(done, done.fail);
    });

    it('can add/remove transactions', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        expect(set.length).toBe(1);
        expect(set.transactions[0]).toBe(tx1);

        set.add(tx2);
        expect(set.length).toBe(2);
        expect(set.transactions[0]).toBe(tx2);
        expect(set.transactions[1]).toBe(tx1);

        set.remove(tx1);
        expect(set.length).toBe(1);
        expect(set.transactions[0]).toBe(tx2);

        set.remove(tx2);
        expect(set.length).toBe(0);
    });

    it('correctly adds getter values', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        set.add(tx2);

        expect(set.length).toBe(2);
        expect(set.sender.equals(tx1.sender)).toBe(true);
        expect(set.senderType).toBe(tx1.senderType);
    });

    it('correctly filters by fee/byte', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        set.add(tx2);
        set.add(tx3);

        expect(set.numBelowFeePerByte(100)).toBe(3);
        expect(set.numBelowFeePerByte(1)).toBe(1);
    });

    it('has toString method', (done) => {
        (async function () {
            const set = new MempoolTransactionSet();

            set.add(tx1);
            set.add(tx2);
            set.add(tx3);

            expect(() => set.toString()).not.toThrow();
        })().then(done, done.fail);
    });
});
