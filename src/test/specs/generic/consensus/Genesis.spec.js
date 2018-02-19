describe('Genesis', () => {
    beforeEach(function (done) {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('Block is valid (testing)', (done) => {
        (async () => {
            time = new Time();
            expect(await Block.GENESIS.verify(time)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('Block.HASH matches Block.hash() (testing)', () => {
        expect(Block.GENESIS.HASH.equals(Block.GENESIS.hash())).toBeTruthy();
    });

    it('Block is valid (real)', (done) => {
        (async () => {
            time = new Time();
            expect(await Block.OLD_GENESIS.verify(time)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('Block.HASH matches Block.hash() (real)', () => {
        expect(Block.OLD_GENESIS.HASH.equals(Block.OLD_GENESIS.hash())).toBeTruthy();
    });

    it('Accounts matches Block hash (testing)', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            await accounts.initialize(Block.GENESIS, Accounts.GENESIS);
            expect(BufferUtils.equals(await accounts.hash(), Block.GENESIS.accountsHash)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('Accounts matches Block hash (real)', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            await accounts.initialize(Block.OLD_GENESIS, Accounts.OLD_GENESIS);
            expect(BufferUtils.equals(await accounts.hash(), Block.OLD_GENESIS.accountsHash)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('matches initial supply (testing)', () => {
        const buf = BufferUtils.fromBase64(Accounts.GENESIS);
        const count = buf.readUint16();
        let initialSupply = 0;
        for (let i = 0; i < count; i++) {
            const address = Address.unserialize(buf);
            const account = Account.unserialize(buf);
            initialSupply += account.balance;
        }
        expect(initialSupply).toEqual(Policy.INITIAL_SUPPLY);
    });

    it('matches initial supply (testing)', () => {
        const buf = BufferUtils.fromBase64(Accounts.OLD_GENESIS);
        const count = buf.readUint16();
        let initialSupply = 0;
        for (let i = 0; i < count; i++) {
            const address = Address.unserialize(buf);
            const account = Account.unserialize(buf);
            initialSupply += account.balance;
        }
        expect(initialSupply).toEqual(Policy.INITIAL_SUPPLY);
    });
});
