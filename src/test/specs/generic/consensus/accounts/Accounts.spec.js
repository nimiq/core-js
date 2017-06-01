
describe('Accounts', () => {

    it('cannot commit a wrong block', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const block = await testBlockchain.createBlock();
            const accounts = await Accounts.createVolatile();
            let error_thrown = false;
            try {
                await accounts.commitBlock(block);
            } catch (e) {
                expect(e).toBe('AccountsHash mismatch');
                error_thrown = true;
            }
            expect(error_thrown).toBe(true);
        })().then(done, done.fail);
    });

    it('can apply and revert a block', (done) => {
        // prepare everything and serialize accountstree
        async function test() {
            const accountState = new Balance(10, 0);
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const accounts = testBlockchain._accounts;

            for (let i = 3; i > 0; i--) {
                const senderPubKey = new PublicKey(Dummy[`publicKey${i}`]);
                const addr = await senderPubKey.toAddress(); // eslint-disable-line no-await-in-loop
                await accounts._tree.put(addr, accountState); // eslint-disable-line no-await-in-loop
            }

            const accountsHash1 = await accounts.hash();
            const block = await testBlockchain.createBlock();
            await accounts.commitBlock(block);
            let accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(false);
            await accounts.revertBlock(block);
            accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(true);
            done();
        }
        test();
    });

    it('put and get an account', (done) => {
        const balance = 42;
        const nonce = 192049;
        const accountState1 = new Balance(balance, nonce);
        const accountAddress = new Address(Dummy.address2);

        async function test() {
            account = await Accounts.createVolatile();
            await account._tree.put(accountAddress, accountState1);
            const accountState2 = await account.getBalance(accountAddress);
            expect(accountState1.nonce).toBe(accountState2.nonce);

            // Verify that getBalance() returns Balance.INITIAL when called with an unknown address
            const accountState3 = await account.getBalance(new Address(Dummy.address3));
            expect(Balance.INITIAL.equals(accountState3)).toBe(true);

            done();
        }
        test();
    });

    it('can handle larger chains', (done) => {
        async function test() {
            console.log('START LONG TEST');
            const testBlockchain = await TestBlockchain.createVolatileTest(100);

            console.log('END LONG TEST');
            done();
        }
        test();
    }, jasmine.DEFAULT_TIMEOUT_INTERVAL * 2);

});
