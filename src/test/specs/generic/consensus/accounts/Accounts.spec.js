
describe('Accounts', () => {

    it('cannot commit a wrong block', (done) => {
        const block = Dummy.block1;
        Accounts.createVolatile().then( accounts =>
            accounts.commitBlock(block)
                .then( () => {
                    expect(true).toBe(false);
                    done();
                })
                .catch( (e) => {
                    expect(e).toBe('AccountsHash mismatch');
                    done();
                })
        );
    });

    it('can apply and revert a block', (done) => {
        // prepare everything and serialize accountstree
        async function test() {
            const accounts = await Accounts.createVolatile();
            const accountState = new Balance(10, 0);

            for (let i = 3; i > 0; i--) {
                const senderPubKey = new PublicKey(Dummy[`publicKey${i}`]);
                const addr = await senderPubKey.toAddress(); // eslint-disable-line no-await-in-loop
                await accounts._tree.put(addr, accountState); // eslint-disable-line no-await-in-loop
            }

            const accountsHash1 = await accounts.hash();
            await accounts.commitBlock(Dummy.accountsBlock);
            await accounts.revertBlock(Dummy.accountsBlock);
            const accountsHash2 = await accounts.hash();
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
