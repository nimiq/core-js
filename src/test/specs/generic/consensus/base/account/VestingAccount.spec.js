describe('VestingAccount', () => {
    const pubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const sender = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('can serialize and unserialize itself', () => {
        const account = new VestingAccount(1000, 1, 1440, 1, 800);
        const account2 = /** @type {VestingAccount} */ Account.unserialize(account.serialize());

        expect(account2 instanceof VestingAccount).toBeTruthy();
        expect(account2.type).toEqual(account.type);
        expect(account2.balance).toEqual(account.balance);
        expect(account2.vestingStart).toEqual(account.vestingStart);
        expect(account2.vestingStepBlocks).toEqual(account.vestingStepBlocks);
        expect(account2.vestingStepAmount).toEqual(account.vestingStepAmount);
        expect(account2.vestingTotalAmount).toEqual(account.vestingTotalAmount);
    });

    it('can handle balance changes', () => {
        const account = new VestingAccount(0);

        expect(account.balance).toBe(0);
        expect(account.withBalance(10).balance).toBe(10);
        expect(account.withBalance(Number.MAX_SAFE_INTEGER).balance).toBe(Number.MAX_SAFE_INTEGER);
        expect(account.withBalance(Number.MAX_SAFE_INTEGER).withBalance(0).balance).toBe(0);

        expect(() => account.withBalance(-1)).toThrowError('Malformed balance');
        expect(() => account.withBalance(NaN)).toThrowError('Malformed balance');
    });


    it('can accept incoming transactions', (done) => {
        (async () => {
            const transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);
            expect(await VestingAccount.verifyIncomingTransaction(transaction)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can apply incoming transactions', () => {
        let account = new VestingAccount(0);

        expect(account.balance).toBe(0);

        let transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);
        account = account.withIncomingTransaction(transaction, 1);

        expect(account.balance).toBe(100);

        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        account = account.withIncomingTransaction(transaction, 2);

        expect(account.balance).toBe(101);
    });

    it('can revert incoming transaction', () => {
        let account = new VestingAccount(0);
        const transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);

        expect(account.balance).toBe(0);

        account = account.withIncomingTransaction(transaction, 1);

        expect(account.balance).toBe(100);

        account = account.withIncomingTransaction(transaction, 1, true);

        expect(account.balance).toBe(0);
    });

    it('can falsify invalid outgoing transaction', (done) => {
        (async () => {
            const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

            const transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0, signature);

            expect(await VestingAccount.verifyOutgoingTransaction(transaction)).toBeFalsy();
        })().then(done, done.fail);
    });

    it('can verify valid outgoing transaction', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();

            const transaction = new BasicTransaction(keyPair.publicKey, recipient, 100, 0, 0);
            transaction.signature = await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent());

            expect(await VestingAccount.verifyOutgoingTransaction(transaction)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can apply outgoing transaction', () => {
        let account = new VestingAccount(100, 0, 100, 50);

        expect(account.balance).toBe(100);

        const cache = new TransactionsCache();
        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 110);
        account = account.withOutgoingTransaction(transaction, 110, cache);

        expect(account.balance).toBe(99);

        transaction = new BasicTransaction(pubKey, recipient, 50, 0, 220);
        account = account.withOutgoingTransaction(transaction, 220, cache);

        expect(account.balance).toBe(49);

        transaction = new BasicTransaction(pubKey, recipient, 49, 0, 230);
        account = account.withOutgoingTransaction(transaction, 230, cache);

        expect(account.balance).toBe(0);
    });

    it('refuses to apply invalid outgoing transaction', () => {
        const account = new VestingAccount(100, 0, 100, 50);

        const cache = new TransactionsCache();
        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 1);

        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 1, cache)).toThrowError('Balance Error!');

        transaction = new BasicTransaction(pubKey, recipient, 75, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 150, cache)).toThrowError('Balance Error!');

        transaction = new BasicTransaction(pubKey, recipient, 101, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 1500, cache)).toThrowError('Balance Error!');

        // TODO: more tests
    });

    it('can revert outgoing transaction', () => {
        let account = new VestingAccount(100);

        expect(account.balance).toBe(100);

        const cache = new TransactionsCache();
        const transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        account = account.withOutgoingTransaction(transaction, 1, cache);

        expect(account.balance).toBe(99);
        cache.transactions.add(transaction);

        account = account.withOutgoingTransaction(transaction, 1, cache, true);

        expect(account.balance).toBe(100);
    });
    
    it('can create vesting account via transaction and vest it', () => {
        const cache = new TransactionsCache();

        let buf = new SerialBuffer(4);
        buf.writeUint32(1000);
        let creationTransaction = new ExtendedTransaction(sender, Account.Type.BASIC, recipient, Account.Type.VESTING, 100, 0, 0, buf);
        let account = VestingAccount.INITIAL.withIncomingTransaction(creationTransaction, 1);
        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 2);
        expect(() => account.withOutgoingTransaction(transaction, 2, cache)).toThrowError('Balance Error!');
        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 1001);
        expect(account.withOutgoingTransaction(transaction, 1001, cache).balance).toBe(99);
        
        buf = new SerialBuffer(16);
        buf.writeUint32(0);
        buf.writeUint32(100);
        buf.writeUint64(50);
        creationTransaction = new ExtendedTransaction(sender, Account.Type.BASIC, recipient, Account.Type.VESTING, 100, 0, 0, buf);
        account = VestingAccount.INITIAL.withIncomingTransaction(creationTransaction, 1);
        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 2);
        expect(() => account.withOutgoingTransaction(transaction, 2, cache)).toThrowError('Balance Error!');
        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 101);
        expect(account.withOutgoingTransaction(transaction, 101, cache).balance).toBe(99);
        transaction = new BasicTransaction(pubKey, recipient, 51, 0, 101);
        expect(() => account.withOutgoingTransaction(transaction, 101, cache)).toThrowError('Balance Error!');
        transaction = new BasicTransaction(pubKey, recipient, 51, 0, 201);
        expect(account.withOutgoingTransaction(transaction, 201, cache).balance).toBe(49);

        buf = new SerialBuffer(24);
        buf.writeUint32(0);
        buf.writeUint32(100);
        buf.writeUint64(40);
        buf.writeUint64(80);
        creationTransaction = new ExtendedTransaction(sender, Account.Type.BASIC, recipient, Account.Type.VESTING, 100, 0, 0, buf);
        account = VestingAccount.INITIAL.withIncomingTransaction(creationTransaction, 1);
        transaction = new BasicTransaction(pubKey, recipient, 20, 0, 2);
        expect(account.withOutgoingTransaction(transaction, 2, cache).balance).toBe(80);
        transaction = new BasicTransaction(pubKey, recipient, 60, 0, 2);
        expect(() => account.withOutgoingTransaction(transaction, 2, cache)).toThrowError('Balance Error!');
        transaction = new BasicTransaction(pubKey, recipient, 60, 0, 101);
        expect(account.withOutgoingTransaction(transaction, 101, cache).balance).toBe(40);
        transaction = new BasicTransaction(pubKey, recipient, 100, 0, 101);
        expect(() => account.withOutgoingTransaction(transaction, 101, cache)).toThrowError('Balance Error!');
        transaction = new BasicTransaction(pubKey, recipient, 100, 0, 201);
        expect(account.withOutgoingTransaction(transaction, 201, cache).balance).toBe(0);
    });

    it('has toString method', (done) => {
        (async function () {
            const account = new VestingAccount(100);
            expect(() => account.toString()).not.toThrow();
        })().then(done, done.fail);
    });
});
