
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
            const accountState = new Account(new Balance(10, 0));

            for (let i = 3; i > 0; i--) {
                const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy[`publicKey${i}`]));
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
        const accountState1 = new Account(new Balance(balance, nonce));
        const accountAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        async function test() {
            const account = await Accounts.createVolatile();
            await account._tree.put(accountAddress, accountState1);
            const balanceState1 = await account.getBalance(accountAddress);
            expect(balanceState1.nonce).toBe(accountState1.balance.nonce);

            // Verify that getBalance() returns Balance.INITIAL when called with an unknown address
            const balanceState2 = await account.getBalance(Address.unserialize(BufferUtils.fromBase64(Dummy.address3)));
            expect(Balance.INITIAL.equals(balanceState2)).toBe(true);
            done();
        }
        test();
    });
});
