describe('WalletStore', () => {
    let walletStore;

    beforeEach((done) => {
        (async () => {
            walletStore = await new WalletStore('wallet_test');
        })().then(done, done.fail);
    });

    afterEach((done) => {
        (async () => {
            await walletStore._jdb.destroy();
        })().then(done, done.fail);
    });

    it('can store, retrieve and remove regular wallets', (done) => {
        (async () => {
            const wallet1 = await Wallet.generate();
            const wallet2 = await Wallet.generate();

            expect(await walletStore.list()).toEqual([]);

            await walletStore.put(wallet1);
            await walletStore.put(wallet2);
            expect((await walletStore.list()).length).toBe(2);

            readWallet1 = await walletStore.get(wallet1.address);
            readWallet2 = await walletStore.get(wallet2.address);

            expect(readWallet1.equals(wallet1)).toBeTruthy();
            expect(readWallet2.equals(wallet2)).toBeTruthy();

            await walletStore.remove(wallet1.address);
            await walletStore.remove(wallet2.address);
            expect((await walletStore.list()).length).toBe(0);
        })().then(done, done.fail);
    });

    it('can store, retrieve and remove encrypted wallets', (done) => {
        (async () => {
            const wallet1 = await Wallet.generate();
            const wallet2 = await Wallet.generate();

            expect(await walletStore.list()).toEqual([]);

            await walletStore.put(wallet1, 'test');
            await walletStore.put(wallet2, 'test1');
            expect((await walletStore.list()).length).toBe(2);

            readWallet1 = await walletStore.get(wallet1.address, 'test');
            readWallet2 = await walletStore.get(wallet2.address, 'test1');

            expect(readWallet1.equals(wallet1)).toBeTruthy();
            expect(readWallet2.equals(wallet2)).toBeTruthy();

            await walletStore.remove(wallet1.address);
            await walletStore.remove(wallet2.address);
            expect((await walletStore.list()).length).toBe(0);
        })().then(done, done.fail);
    });

    it('can store, retrieve and remove multisig wallets', (done) => {
        (async () => {
            const keyPair1 = KeyPair.generate();
            const keyPair2 = KeyPair.generate();

            const wallet1 = MultiSigWallet.fromPublicKeys(keyPair1, 2, [keyPair1.publicKey, keyPair2.publicKey]);
            const wallet2 = MultiSigWallet.fromPublicKeys(keyPair2, 2, [keyPair2.publicKey, keyPair1.publicKey]);

            expect(await walletStore.listMultiSig()).toEqual([]);

            await walletStore.putMultiSig(wallet1);
            await walletStore.putMultiSig(wallet2);
            expect((await walletStore.listMultiSig()).length).toBe(2);

            readWallet1 = await walletStore.getMultiSig(wallet1.address);
            readWallet2 = await walletStore.getMultiSig(wallet2.address);

            expect(readWallet1.equals(wallet1)).toBeTruthy();
            expect(readWallet2.equals(wallet2)).toBeTruthy();

            await walletStore.removeMultiSig(wallet1.address);
            await walletStore.removeMultiSig(wallet2.address);
            expect((await walletStore.listMultiSig()).length).toBe(0);
        })().then(done, done.fail);
    });

    it('can store, retrieve and remove encrypted multisig wallets', (done) => {
        (async () => {
            const keyPair1 = KeyPair.generate();
            const keyPair2 = KeyPair.generate();

            const wallet1 = MultiSigWallet.fromPublicKeys(keyPair1, 2, [keyPair1.publicKey, keyPair2.publicKey]);
            const wallet2 = MultiSigWallet.fromPublicKeys(keyPair2, 2, [keyPair2.publicKey, keyPair1.publicKey]);

            expect(await walletStore.listMultiSig()).toEqual([]);

            await walletStore.putMultiSig(wallet1, 'test');
            await walletStore.putMultiSig(wallet2, 'test1');
            expect((await walletStore.listMultiSig()).length).toBe(2);

            readWallet1 = await walletStore.getMultiSig(wallet1.address, 'test');
            readWallet2 = await walletStore.getMultiSig(wallet2.address, 'test1');

            expect(readWallet1.equals(wallet1)).toBeTruthy();
            expect(readWallet2.equals(wallet2)).toBeTruthy();

            await walletStore.removeMultiSig(wallet1.address);
            await walletStore.removeMultiSig(wallet2.address);
            expect((await walletStore.listMultiSig()).length).toBe(0);
        })().then(done, done.fail);
    });

    it('can store, retrieve and remove a default wallet', (done) => {
        (async () => {
            const wallet1 = await Wallet.generate();

            expect(await walletStore.list()).toEqual([]);

            await walletStore.put(wallet1);
            expect((await walletStore.list()).length).toBe(1);

            await walletStore.setDefault(wallet1.address);
            expect(await walletStore.hasDefault()).toBeTruthy();
            expect((await walletStore.getDefault()).equals(wallet1)).toBeTruthy();

            await walletStore.remove(wallet1.address);
            expect((await walletStore.list()).length).toBe(0);
            expect(await walletStore.hasDefault()).toBeFalsy();
        })().then(done, done.fail);
    });
});
