describe('Wallet', () => {
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 8888888;
    const fee = 888;
    const nonce = 8;
    const deepLockRounds = KeyPair.DEEP_LOCK_ROUNDS;
    
    beforeAll(() => {
        // Temporarily reduce deep lock rounds.
        KeyPair.DEEP_LOCK_ROUNDS = KeyPair.LOCK_ROUNDS;
    });
    
    afterAll(() => {
        KeyPair.DEEP_LOCK_ROUNDS = deepLockRounds;
    });

    it('can create a signed transaction', (done) => {
        (async () => {
            const wallet = await Wallet.createVolatile();
            const transaction = await wallet.createTransaction(recipient, value, fee, nonce);
            const isValid = await transaction.verify();
            expect(isValid).toBe(true);
        })().then(done, done.fail);
    });

    it('can reject invalid wallet seed', (done) => {
        (async () => {
            expect(() => {
                Wallet.load('');
            }).toThrowError('Invalid wallet seed');

            expect(() => {
                Wallet.load('i am not a valid base64 seed :(');
            }).toThrowError('Invalid wallet seed');

            expect(() => {
                Wallet.load('527ec2efe780dc38a5561348b928bf0225a6986c0b56796ba9af81f91b10c16ffdaa8cab1175bfbf7de576bb0b0009737ecb5c59e60bd0c86fae0f9fa457706b8fca286eaa4030fcd6d2b4d55d24f243f08c9c8bf03d5c1e11ab3860f759607');
            }).toThrowError('Invalid wallet seed');
        })().then(done, done.fail);
    });

    it('can import valid wallet seed', (done) => {
        (async () => {
            const wallet = await Wallet.createVolatile();
            const wallet2 = await Wallet.load(wallet.dump());

            expect(wallet.keyPair.equals(wallet2.keyPair)).toBeTruthy();
            expect(wallet.address.equals(wallet2.address)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can lock, unlock and relock itself', (done) => {
        (async () => {
            const wallet = await Wallet.createVolatile();
            const key = 'password';

            expect(wallet.isLocked).toBeFalsy();
            await wallet.lock(key);
            expect(wallet.isLocked).toBeTruthy();
            await wallet.unlock(key);
            expect(wallet.isLocked).toBeFalsy();
            wallet.relock();
            expect(wallet.isLocked).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can create a deep-locked wallet and import it', (done) => {
        (async () => {
            const wallet = await Wallet.createVolatile();
            const key = 'password';

            const deepLockedWallet = await wallet.deepLock(key);
            const unlockedWallet = await Wallet.loadDeepLocked(deepLockedWallet, key);
            expect(unlockedWallet.keyPair.privateKey).toEqual(wallet.keyPair.privateKey);
            expect(unlockedWallet.address).toEqual(wallet.address);
        })().then(done, done.fail);
    });

    it('can detect wrong key when creating a deep-locked wallet from locked wallet', (done) => {
        (async () => {
            const wallet = await Wallet.createVolatile();
            const key = 'password';
            const key2 = '123456';

            await wallet.lock(key);
            let err = false;
            await wallet.deepLock(key2).catch(() => err = true);
            expect(err).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can detect wrong key on deep-locked wallet', (done) => {
        (async () => {
            const wallet = await Wallet.createVolatile();
            const key = 'password';
            const key2 = '123456';

            const deepLockedWallet = await wallet.deepLock(key);
            let err = false;
            await Wallet.loadDeepLocked(deepLockedWallet, key2).catch(() => err = true);
            expect(err).toBeTruthy();
        })().then(done, done.fail);
    });
});
