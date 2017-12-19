describe('MempoolTransactionSet', () => {
    let tx1, tx2, tx3;

    beforeAll((done) => {
        (async () => {
            const users = await TestBlockchain.getUsers(2);
            tx1 = await TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 2000, 5, 1, users[0].privateKey);
            tx2 = await TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1000, 500, 1, users[0].privateKey);
            tx3 = await TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 3000, 500, 2, users[0].privateKey);
        })().then(done, done.fail);
    });

    it('can add transactions', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        expect(set.length).toBe(1);
        expect(set.transactions[0]).toBe(tx1);

        set.add(tx2);
        expect(set.length).toBe(2);
        expect(set.transactions[0]).toBe(tx2);
        expect(set.transactions[1]).toBe(tx1);
    });

    it('correctly adds getter values', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        set.add(tx2);

        expect(set.length).toBe(2);
        expect(set.serializedSize).toBe(tx1.serializedSize + tx2.serializedSize);
        expect(set.value).toBe(tx1.value + tx2.value);
        expect(set.fee).toBe(tx1.fee + tx2.fee);
        expect(set.sender.equals(tx1.sender)).toBe(true);
        expect(set.senderType).toBe(tx1.senderType);
    });

    it('can shift transactions', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        set.add(tx2);
        set.add(tx3);

        expect(set.length).toBe(3);
        expect(set.shift()).toBe(tx3); // Highest fee
        expect(set.length).toBe(2);
    });

    it('can pop transactions', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        set.add(tx2);
        set.add(tx3);

        expect(set.length).toBe(3);
        expect(set.pop()).toBe(tx1); // Lowest fee
        expect(set.length).toBe(2);
    });

    it('correctly filters by fee/byte', () => {
        const set = new MempoolTransactionSet();

        set.add(tx1);
        set.add(tx2);
        set.add(tx3);

        expect(set.numBelowFeePerByte(100)).toBe(3);
        expect(set.numBelowFeePerByte(1)).toBe(1);
    });
});
