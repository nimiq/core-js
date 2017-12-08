describe('Wallet', () => {
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 8888888;
    const fee = 888;
    const nonce = 8;

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
            }).toThrow('Invalid wallet seed');

            expect(() => {
                Wallet.load('i am not a valid base64 seed :(');
            }).toThrow('Invalid wallet seed');

            expect(() => {
                Wallet.load('527ec2efe780dc38a5561348b928bf0225a6986c0b56796ba9af81f91b10c16ffdaa8cab1175bfbf7de576bb0b0009737ecb5c59e60bd0c86fae0f9fa457706b8fca286eaa4030fcd6d2b4d55d24f243f08c9c8bf03d5c1e11ab3860f759607');
            }).toThrow('Invalid wallet seed');
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
});
