describe('Genesis', () => {

    it('light Block is valid', (done) => {
        (async () => {
            for (const networkId in GenesisConfig.CONFIGS) {
                expect(await GenesisConfig.CONFIGS[networkId].GENESIS_BLOCK.toLight().verify(new Time())).toBeTruthy(`networkId ${networkId}`);
            }
        })().then(done, done.fail);
    });

    it('Block is valid', (done) => {
        (async () => {
            time = new Time();
            for (const networkId in GenesisConfig.CONFIGS) {
                expect(await GenesisConfig.CONFIGS[networkId].GENESIS_BLOCK.verify(new Time())).toBeTruthy(`networkId ${networkId}`);
            }
        })().then(done, done.fail);
    });

    it('Accounts matches Block hash', (done) => {
        (async () => {
            for (const networkId in GenesisConfig.CONFIGS) {
                const accounts = await Accounts.createVolatile();
                await accounts.initialize(GenesisConfig.CONFIGS[networkId].GENESIS_BLOCK, GenesisConfig.CONFIGS[networkId].GENESIS_ACCOUNTS);
                expect(BufferUtils.equals(await accounts.hash(), GenesisConfig.CONFIGS[networkId].GENESIS_BLOCK.accountsHash)).toBeTruthy(`networkId ${networkId}`);
            }
        })().then(done, done.fail);
    });

    it('matches initial supply', () => {
        for (const networkId in GenesisConfig.CONFIGS) {
            const buf = BufferUtils.fromBase64(GenesisConfig.CONFIGS[networkId].GENESIS_ACCOUNTS);
            const count = buf.readUint16();
            let initialSupply = 0;
            for (let i = 0; i < count; i++) {
                const address = Address.unserialize(buf);
                const account = Account.unserialize(buf);
                initialSupply += account.balance;
            }
            expect(initialSupply).toEqual(Policy.INITIAL_SUPPLY, `networkId ${networkId}`);
        }
    });
});
