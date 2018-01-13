describe('MultiSigWallet', () => {
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 8888888;
    const fee = 888;
    const deepLockRounds = KeyPair.EXPORT_KDF_ROUNDS;

    beforeAll((done) => {
        // Temporarily reduce deep lock rounds.
        KeyPair.EXPORT_KDF_ROUNDS = KeyPair.LOCK_KDF_ROUNDS;
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    afterAll(() => {
        KeyPair.EXPORT_KDF_ROUNDS = deepLockRounds;
    });

    it('can create a signed transaction', () => {
        const keyPair1 = KeyPair.generate();
        const keyPair2 = KeyPair.generate();

        const wallet1 = MultiSigWallet.fromPublicKeys(keyPair1, 2, [keyPair1.publicKey, keyPair2.publicKey]);
        const wallet2 = MultiSigWallet.fromPublicKeys(keyPair2, 2, [keyPair2.publicKey, keyPair1.publicKey]);

        const commitmentPair1 = wallet1.createCommitment();
        const commitmentPair2 = wallet2.createCommitment();
        const aggregatedCommitment = Commitment.sum([commitmentPair1.commitment, commitmentPair2.commitment]);
        const aggregatedPublicKey = PublicKey.sum([keyPair1.publicKey, keyPair2.publicKey]);

        let transaction = wallet1.createTransaction(recipient, value, fee, 1);

        const partialSignature1 = wallet1.signTransaction(transaction, [keyPair1.publicKey, keyPair2.publicKey],
            aggregatedCommitment, commitmentPair1.secret);
        const partialSignature2 = wallet2.signTransaction(transaction, [keyPair1.publicKey, keyPair2.publicKey],
            aggregatedCommitment, commitmentPair2.secret);

        transaction = wallet1.completeTransaction(transaction, aggregatedPublicKey, aggregatedCommitment,
            [partialSignature1, partialSignature2]);
        const isValid = transaction.verify();
        expect(isValid).toBe(true);
    });

    it('can reject invalid wallet seed', () => {
        expect(() => {
            MultiSigWallet.loadPlain('');
        }).toThrowError('Invalid wallet seed');

        expect(() => {
            MultiSigWallet.loadPlain('i am not a valid base64 seed :(');
        }).toThrowError('Invalid wallet seed');

        expect(() => {
            MultiSigWallet.loadPlain('527ec2efe780dc38a5561348b928bf0225a6986c0b56796ba9af81f91b10c16ffdaa8cab1175bfbf7de576bb0b0009737ecb5c59e60bd0c86fae0f9fa457706b8fca286eaa4030fcd6d2b4d55d24f243f08c9c8bf03d5c1e11ab3860f759607');
        }).toThrowError('Invalid wallet seed');
    });

    it('can export & import a plaintext wallet', () => {
        const keyPair1 = KeyPair.generate();
        const keyPair2 = KeyPair.generate();
        const wallet = MultiSigWallet.fromPublicKeys(keyPair1, 1, [keyPair1.publicKey, keyPair2.publicKey]);
        const wallet2 = MultiSigWallet.loadPlain(wallet.exportPlain());

        expect(wallet.keyPair.equals(wallet2.keyPair)).toBeTruthy();
        expect(wallet.address.equals(wallet2.address)).toBeTruthy();
        expect(wallet2.minSignatures).toBe(wallet.minSignatures);
        expect(wallet2.publicKeys.length).toBe(wallet.publicKeys.length);
        for (let i = 0; i < wallet2.publicKeys.length; ++i) {
            expect(wallet2.publicKeys[i].equals(wallet.publicKeys[i])).toBeTruthy();
        }
    });

    it('can lock, unlock and relock itself', (done) => {
        (async () => {
            const keyPair1 = KeyPair.generate();
            const keyPair2 = KeyPair.generate();
            const wallet = MultiSigWallet.fromPublicKeys(keyPair1, 1, [keyPair1.publicKey, keyPair2.publicKey]);
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

    it('can export an encrypted wallet and import it', (done) => {
        (async () => {
            const keyPair1 = KeyPair.generate();
            const keyPair2 = KeyPair.generate();
            const wallet = MultiSigWallet.fromPublicKeys(keyPair1, 1, [keyPair1.publicKey, keyPair2.publicKey]);
            const key = 'password';

            const encryptedWallet = await wallet.exportEncrypted(key);
            const unlockedWallet = await MultiSigWallet.loadEncrypted(encryptedWallet, key);
            expect(wallet.keyPair.equals(unlockedWallet.keyPair)).toBeTruthy();
            expect(wallet.address.equals(unlockedWallet.address)).toBeTruthy();
            expect(wallet.minSignatures).toBe(unlockedWallet.minSignatures);
            expect(unlockedWallet.publicKeys.length).toBe(wallet.publicKeys.length);
            for (let i = 0; i < unlockedWallet.publicKeys.length; ++i) {
                expect(unlockedWallet.publicKeys[i].equals(wallet.publicKeys[i])).toBeTruthy();
            }
        })().then(done, done.fail);
    });

    it('can detect wrong key when exporting an encrypted wallet from locked wallet', (done) => {
        (async () => {
            const keyPair1 = KeyPair.generate();
            const keyPair2 = KeyPair.generate();
            const wallet = MultiSigWallet.fromPublicKeys(keyPair1, 1, [keyPair1.publicKey, keyPair2.publicKey]);
            const key = 'password';
            const key2 = '123456';

            await wallet.lock(key);
            let err = false;
            await wallet.exportEncrypted(key2).catch(() => err = true);
            expect(err).toBeTruthy();

            err = false;
            await wallet.exportEncrypted(key, key2).catch(() => err = true);
            expect(err).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can detect wrong key on an encrypted wallet', (done) => {
        (async () => {
            const keyPair1 = KeyPair.generate();
            const keyPair2 = KeyPair.generate();
            const wallet = MultiSigWallet.fromPublicKeys(keyPair1, 1, [keyPair1.publicKey, keyPair2.publicKey]);
            const key = 'password';
            const key2 = '123456';

            const encryptedWallet = await wallet.exportEncrypted(key);
            let err = false;
            await Wallet.loadEncrypted(encryptedWallet, key2).catch(() => err = true);
            expect(err).toBeTruthy();
        })().then(done, done.fail);
    });
});
