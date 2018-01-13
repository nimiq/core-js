describe('Subscription', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress;
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const nonce = 1;
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
    const proof = BufferUtils.fromAscii('ABCD');
    const data = BufferUtils.fromAscii('EFGH');
    const unrelatedAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));
    let testBlockchain, block, tx1, tx2, txHighFee;

    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();

            senderAddress = senderPubKey.toAddress();

            // create testing blockchain with only genesis and dummy users
            testBlockchain = await TestBlockchain.createVolatileTest(0);
            block = await testBlockchain.createBlock();

            tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
            tx2 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddr, Account.Type.BASIC, value, fee, nonce, Transaction.Flag.NONE, data, proof);

            txHighFee = new BasicTransaction(senderPubKey, recipientAddr, value, tx1.serializedSize*2, nonce, signature);
        })().then(done, done.fail);
    });

    it('NONE subscription does not match anything', (done) => {
        (async function () {const sub = Subscription.NONE;
            expect(sub.matchesBlock(block)).toBe(false);
            expect(sub.matchesTransaction(tx1)).toBe(false);
            expect(sub.matchesTransaction(tx2)).toBe(false);
        })().then(done, done.fail);
    });

    it('ANY subscription does match anything', (done) => {
        (async function () {
            const sub = Subscription.ANY;
            expect(sub.matchesBlock(block)).toBe(true);
            expect(sub.matchesTransaction(tx1)).toBe(true);
            expect(sub.matchesTransaction(tx2)).toBe(true);
        })().then(done, done.fail);
    });

    it('ADDRESSES subscription does match only subscribed addresses', (done) => {
        (async function () {
            let sub = Subscription.fromAddresses([senderAddress]);
            expect(sub.matchesBlock(block)).toBe(true);
            expect(sub.matchesTransaction(tx1)).toBe(true, 'Did not match sender address');
            expect(sub.matchesTransaction(tx2)).toBe(true, 'Did not match sender address');

            sub = Subscription.fromAddresses([recipientAddr]);
            expect(sub.matchesBlock(block)).toBe(true);
            expect(sub.matchesTransaction(tx1)).toBe(true, 'Did not match recipient address');
            expect(sub.matchesTransaction(tx2)).toBe(true, 'Did not match recipient address');

            sub = Subscription.fromAddresses([unrelatedAddr]);
            expect(sub.matchesBlock(block)).toBe(true);
            expect(sub.matchesTransaction(tx1)).toBe(false, 'Did match unrelated address');
            expect(sub.matchesTransaction(tx2)).toBe(false, 'Did match unrelated address');

            sub = Subscription.fromAddresses([senderAddress, unrelatedAddr]);
            expect(sub.matchesBlock(block)).toBe(true);
            expect(sub.matchesTransaction(tx1)).toBe(true, 'Did not match sender address');
            expect(sub.matchesTransaction(tx2)).toBe(true, 'Did not match sender address');
        })().then(done, done.fail);
    });

    it('MIN_FEE subscription does match transactions with matching min fee', (done) => {
        (async function () {
            let sub = Subscription.fromMinFeePerByte(1);
            expect(sub.matchesBlock(block)).toBe(true);
            expect(sub.matchesTransaction(tx1)).toBe(false);
            expect(sub.matchesTransaction(tx2)).toBe(false);
            expect(sub.matchesTransaction(txHighFee)).toBe(true);

            sub = Subscription.fromMinFeePerByte(0);
            expect(sub.matchesBlock(block)).toBe(true);
            expect(sub.matchesTransaction(tx1)).toBe(true);
            expect(sub.matchesTransaction(tx2)).toBe(true);
            expect(sub.matchesTransaction(txHighFee)).toBe(true);
        })().then(done, done.fail);
    });

    it('can serialize and unserialize', (done) => {
        (async function () {
            let sub1 = Subscription.NONE;
            let sub2 = Subscription.unserialize(sub1.serialize());
            expect(sub2.type).toBe(sub1.type);
            expect(sub1.addresses.length).toBe(0);
            expect(sub2.addresses.length).toBe(0);

            sub1 = Subscription.ANY;
            sub2 = Subscription.unserialize(sub1.serialize());
            expect(sub2.type).toBe(sub1.type);
            expect(sub1.addresses.length).toBe(0);
            expect(sub2.addresses.length).toBe(0);

            sub1 = Subscription.fromAddresses([Address.fromBase64(Dummy.address1), Address.fromBase64(Dummy.address2)]);
            sub2 = Subscription.unserialize(sub1.serialize());
            expect(sub2.type).toBe(sub1.type);
            expect(sub2.addresses.length).toBe(sub1.addresses.length);
            expect(sub2.addresses.every((addr, i) => addr.equals(sub1.addresses[i]))).toBe(true);

            sub1 = Subscription.fromMinFeePerByte(1000);
            sub2 = Subscription.unserialize(sub1.serialize());
            expect(sub2.type).toBe(sub1.type);
            expect(sub2.minFeePerByte).toBe(sub1.minFeePerByte);
        })().then(done, done.fail);
    });

    it('has toString method', (done) => {
        (async function () {
            const sub = Subscription.NONE;
            expect(() => sub.toString()).not.toThrow();
        })().then(done, done.fail);
    });

    it('does only allow valid types/addresses', (done) => {
        (async function () {
            expect(() => new Subscription('aa')).toThrow();
            expect(() => new Subscription(Subscription.Type.ADDRESSES)).toThrow();
            expect(() => new Subscription(Subscription.Type.ADDRESSES, [senderPubKey])).toThrow();

            const tx = new BasicTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
            const sub = new Subscription(10);
            expect(() => sub.matchesTransaction(tx)).toThrow();
            expect(() => sub.matchesBlock(block)).toThrow();
        })().then(done, done.fail);
    });
});
