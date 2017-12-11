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
        expect(account2.nonce).toEqual(account.nonce);
        expect(account2.vestingStart).toEqual(account.vestingStart);
        expect(account2.vestingStepBlocks).toEqual(account.vestingStepBlocks);
        expect(account2.vestingStepAmount).toEqual(account.vestingStepAmount);
        expect(account2.vestingTotalAmount).toEqual(account.vestingTotalAmount);
    });

    it('can handle balance changes', () => {
        const account = new VestingAccount(0, 0);

        expect(account.balance).toBe(0);
        expect(account.withBalance(10).balance).toBe(10);
        expect(account.withBalance(Number.MAX_SAFE_INTEGER).balance).toBe(Number.MAX_SAFE_INTEGER);
        expect(account.withBalance(Number.MAX_SAFE_INTEGER).withBalance(0).balance).toBe(0);

        expect(() => account.withBalance(-1)).toThrowError('Malformed balance');
        expect(() => account.withBalance(NaN)).toThrowError('Malformed balance');
    });

    it('can handle nonce changes', () => {
        const account = new VestingAccount(0, 0);

        expect(account.nonce).toBe(0);
        expect(account.withBalance(0, 1).nonce).toBe(1);
        expect(account.withBalance(0, 1).withBalance(0, 0).nonce).toBe(0);

        expect(() => account.withBalance(0, -1)).toThrowError('Malformed nonce');
        expect(() => account.withBalance(0, NaN)).toThrowError('Malformed nonce');
    });

    it('can accept incoming transactions', (done) => {
        (async () => {
            const transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);
            expect(await VestingAccount.verifyIncomingTransaction(transaction)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can apply incoming transactions', () => {
        let account = new VestingAccount(0, 0);

        expect(account.balance).toBe(0);

        let transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);
        account = account.withIncomingTransaction(transaction, 1);

        expect(account.balance).toBe(100);

        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        account = account.withIncomingTransaction(transaction, 2);

        expect(account.balance).toBe(101);
    });

    it('can revert incoming transaction', () => {
        let account = new VestingAccount(0, 0);
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
        let account = new VestingAccount(100, 0, 0, 100, 50);

        expect(account.balance).toBe(100);
        expect(account.nonce).toBe(0);

        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        account = account.withOutgoingTransaction(transaction, 110);

        expect(account.balance).toBe(99);
        expect(account.nonce).toBe(1);

        transaction = new BasicTransaction(pubKey, recipient, 50, 0, 1);
        account = account.withOutgoingTransaction(transaction, 220);

        expect(account.balance).toBe(49);
        expect(account.nonce).toBe(2);

        transaction = new BasicTransaction(pubKey, recipient, 49, 0, 2);
        account = account.withOutgoingTransaction(transaction, 230);

        expect(account.balance).toBe(0);
        expect(account.nonce).toBe(3);
    });

    it('refuses to apply invalid outgoing transaction', () => {
        const account = new VestingAccount(100, 0, 0, 100, 50);

        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 1);
        expect(() => account.withOutgoingTransaction(transaction, 150)).toThrowError('Nonce Error!');

        transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 1)).toThrowError('Balance Error!');

        transaction = new BasicTransaction(pubKey, recipient, 75, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 150)).toThrowError('Balance Error!');

        transaction = new BasicTransaction(pubKey, recipient, 101, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 1500)).toThrowError('Balance Error!');
    });

    it('can revert outgoing transaction', () => {
        let account = new VestingAccount(100, 0);

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
    
    it('can create vesting account via transaction and vest it', () => {
        let buf = new SerialBuffer(4);
        buf.writeUint32(1000);
        let creationTransaction = new ExtendedTransaction(sender, Account.Type.BASIC, recipient, Account.Type.VESTING, 100, 0, 0, buf);
        let account = VestingAccount.INITIAL.withIncomingTransaction(creationTransaction, 1);
        let transaction = new BasicTransaction(pubKey, recipient, 1, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 2)).toThrowError('Balance Error!');
        expect(account.withOutgoingTransaction(transaction, 1001).balance).toBe(99);
        
        buf = new SerialBuffer(16);
        buf.writeUint32(0);
        buf.writeUint32(100);
        buf.writeUint64(50);
        creationTransaction = new ExtendedTransaction(sender, Account.Type.BASIC, recipient, Account.Type.VESTING, 100, 0, 0, buf);
        account = VestingAccount.INITIAL.withIncomingTransaction(creationTransaction, 1);
        expect(() => account.withOutgoingTransaction(transaction, 2)).toThrowError('Balance Error!');
        expect(account.withOutgoingTransaction(transaction, 101).balance).toBe(99);
        transaction = new BasicTransaction(pubKey, recipient, 51, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 101)).toThrowError('Balance Error!');
        expect(account.withOutgoingTransaction(transaction, 201).balance).toBe(49);

        buf = new SerialBuffer(24);
        buf.writeUint32(0);
        buf.writeUint32(100);
        buf.writeUint64(40);
        buf.writeUint64(80);
        creationTransaction = new ExtendedTransaction(sender, Account.Type.BASIC, recipient, Account.Type.VESTING, 100, 0, 0, buf);
        account = VestingAccount.INITIAL.withIncomingTransaction(creationTransaction, 1);
        transaction = new BasicTransaction(pubKey, recipient, 20, 0, 0);
        expect(account.withOutgoingTransaction(transaction, 2).balance).toBe(80);
        transaction = new BasicTransaction(pubKey, recipient, 60, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 2)).toThrowError('Balance Error!');
        expect(account.withOutgoingTransaction(transaction, 101).balance).toBe(40);
        transaction = new BasicTransaction(pubKey, recipient, 100, 0, 0);
        expect(() => account.withOutgoingTransaction(transaction, 101)).toThrowError('Balance Error!');
        expect(account.withOutgoingTransaction(transaction, 201).balance).toBe(0);
    });
});
