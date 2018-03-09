describe('Genesis', () => {

    it('light Block is valid (testing)', (done) => {
        (async () => {
            expect(await GenesisConfig.CURRENT_CONFIG.GENESIS_BLOCK.toLight().verify(new Time())).toBeTruthy();
        })().then(done, done.fail);
    });

    it('Block is valid (testing)', (done) => {
        (async () => {
            time = new Time();
            expect(await GenesisConfig.CURRENT_CONFIG.GENESIS_BLOCK.verify(time)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('Block.HASH matches Block.hash() (testing)', () => {
        expect(GenesisConfig.CURRENT_CONFIG.GENESIS_HASH.equals(GenesisConfig.CURRENT_CONFIG.GENESIS_BLOCK.hash())).toBeTruthy();
    });

    it('Block is valid (real)', (done) => {
        (async () => {
            time = new Time();
            expect(await GenesisConfig.OLD_CONFIG.GENESIS_BLOCK.verify(time)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('Block.HASH matches Block.hash() (real)', () => {
        expect(GenesisConfig.OLD_CONFIG.GENESIS_HASH.equals(GenesisConfig.OLD_CONFIG.GENESIS_BLOCK.hash())).toBeTruthy();
    });

    it('Accounts matches Block hash (testing)', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            await accounts.initialize(GenesisConfig.CURRENT_CONFIG.GENESIS_BLOCK, GenesisConfig.CURRENT_CONFIG.GENESIS_ACCOUNTS);
            expect(BufferUtils.equals(await accounts.hash(), GenesisConfig.CURRENT_CONFIG.GENESIS_BLOCK.accountsHash)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('Accounts matches Block hash (real)', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            await accounts.initialize(GenesisConfig.OLD_CONFIG.GENESIS_BLOCK, GenesisConfig.OLD_CONFIG.GENESIS_ACCOUNTS);
            expect(BufferUtils.equals(await accounts.hash(), GenesisConfig.OLD_CONFIG.GENESIS_BLOCK.accountsHash)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('matches initial supply (testing)', () => {
        const buf = BufferUtils.fromBase64(GenesisConfig.CURRENT_CONFIG.GENESIS_ACCOUNTS);
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
        const buf = BufferUtils.fromBase64(GenesisConfig.OLD_CONFIG.GENESIS_ACCOUNTS);
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
