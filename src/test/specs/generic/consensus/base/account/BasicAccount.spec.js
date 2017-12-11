describe('BasicAccount', () => {
    const pubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('can serialize and unserialize itself', () => {
        const account = new BasicAccount(100, 1);
        const account2 = Account.unserialize(account.serialize());

        expect(account.type).toEqual(account2.type);
        expect(account.balance).toEqual(account2.balance);
        expect(account.nonce).toEqual(account2.nonce);
    });

    it('can handle balance changes', () => {
        const account = new BasicAccount(0, 0);

        expect(account.balance).toBe(0);
        expect(account.withBalance(10).balance).toBe(10);
        expect(account.withBalance(Number.MAX_SAFE_INTEGER).balance).toBe(Number.MAX_SAFE_INTEGER);
        expect(account.withBalance(Number.MAX_SAFE_INTEGER).withBalance(0).balance).toBe(0);

        expect(() => account.withBalance(-1)).toThrowError('Malformed balance');
        expect(() => account.withBalance(NaN)).toThrowError('Malformed balance');
    });

    it('can handle nonce changes', () => {
        const account = new BasicAccount(0, 0);

        expect(account.nonce).toBe(0);
        expect(account.withBalance(0, 1).nonce).toBe(1);
        expect(account.withBalance(0, 1).withBalance(0, 0).nonce).toBe(0);

        expect(() => account.withBalance(0, -1)).toThrowError('Malformed nonce');
        expect(() => account.withBalance(0, NaN)).toThrowError('Malformed nonce');
    });

    it('can accept incoming transactions', (done) => {
        (async () => {
            const transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);
            expect(await BasicAccount.verifyIncomingTransaction(transaction)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can apply incoming transactions', () => {
        let account = new BasicAccount(0, 0);

        expect(account.balance).toBe(0);

        let transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);
        account = account.withIncomingTransaction(transaction, 1);

        expect(account.balance).toBe(100);

        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        account = account.withIncomingTransaction(transaction, 2);

        expect(account.balance).toBe(101);
    });

    it('can revert incoming transaction', () => {
        let account = new BasicAccount(0, 0);
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

            expect(await BasicAccount.verifyOutgoingTransaction(transaction)).toBeFalsy();
        })().then(done, done.fail);
    });

    it('can verify valid outgoing transaction', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();

            const transaction = new BasicTransaction(keyPair.publicKey, recipient, 100, 0, 0);
            transaction.signature = await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent());

            expect(await BasicAccount.verifyOutgoingTransaction(transaction)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can apply outgoing transaction', () => {
        let account = new BasicAccount(100, 0);

        expect(account.balance).toBe(100);
        expect(account.nonce).toBe(0);

        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        account = account.withOutgoingTransaction(transaction, 1);

        expect(account.balance).toBe(99);
        expect(account.nonce).toBe(1);

        transaction = new BasicTransaction(pubKey, recipient, 50, 0, 1);
        account = account.withOutgoingTransaction(transaction, 2);

        expect(account.balance).toBe(49);
        expect(account.nonce).toBe(2);
    });

    it('refuses to apply invalid outgoing transaction', () => {
        const account = new BasicAccount(100, 0);

        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 1);
        expect(() => account.withOutgoingTransaction(transaction, 1)).toThrowError('Nonce Error!');

        transaction = new BasicTransaction(pubKey, recipient, 101, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 1)).toThrowError('Balance Error!');
    });

    it('can revert outgoing transaction', () => {
        let account = new BasicAccount(100, 0);

        expect(account.balance).toBe(100);
        expect(account.nonce).toBe(0);

        const transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        account = account.withOutgoingTransaction(transaction, 1);

        expect(account.balance).toBe(99);
        expect(account.nonce).toBe(1);

        account = account.withOutgoingTransaction(transaction, 1, true);

        expect(account.balance).toBe(100);
        expect(account.nonce).toBe(0);
    });
});
