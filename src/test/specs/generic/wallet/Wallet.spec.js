describe('Wallet', () => {
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 8888888;
    const fee = 888;
    const nonce = 8;

    it('can create a signed transaction', (done) => {
        const test = async () => {
            const wallet = await Wallet.createVolatile();
            const transaction = await wallet.createTransaction(recipient, value, fee, nonce);
            const isValid = await transaction.verifySignature();
            expect(isValid).toBe(true);
            done();
        };
        test();
    });

    it('can reject invalid wallet seed', (done) => {
        const test = async () => {
            expect(() => {
                Wallet.load("");
            }).toThrow(Wallet.ERR_INVALID_WALLET_SEED);

            expect(() => {
                Wallet.load("i am not a valid base64 seed :(");
            }).toThrow(Wallet.ERR_INVALID_WALLET_SEED);

            expect(() => {
                Wallet.load("527ec2efe780dc38a5561348b928bf0225a6986c0b56796ba9af81f91b10c16ffdaa8cab1175bfbf7de576bb0b0009737ecb5c59e60bd0c86fae0f9fa457706b8fca286eaa4030fcd6d2b4d55d24f243f08c9c8bf03d5c1e11ab3860f759607");
            }).toThrow(Wallet.ERR_INVALID_WALLET_SEED);

            done();
        };
        test();
    });
});
