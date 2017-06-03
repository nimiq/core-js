describe('Block', () => {

    it('must have a well defined header (116 bytes)', () => {
        expect(() => {
            const test1 = new Block(undefined, Dummy.body1);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(null, Dummy.body1);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(1, Dummy.body1);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(new Uint8Array(101), Dummy.body1);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(Dummy.block1, Dummy.body1);
        }).toThrow('Malformed header');
    });

    it('must have a well defined body (variable size)', () => {
        expect(() => {
            const test1 = new Block(Dummy.header1, undefined);
        }).toThrow('Malformed body');

        expect(() => {
            const test1 = new Block(Dummy.header1, null);
        }).toThrow('Malformed body');

        expect(() => {
            const test1 = new Block(Dummy.header1, 1);
        }).toThrow('Malformed body');

        expect(() => {
            const test1 = new Block(Dummy.header1, new Uint8Array(101));
        }).toThrow('Malformed body');

        expect(() => {
            const test1 = new Block(Dummy.header1, Dummy.block1);
        }).toThrow('Malformed body');
    });

    it('is serializable and unserializable', () => {
        const block1 = Dummy.block1;
        const size = block1.header.serializedSize + block1.body.serializedSize;
        const block2 = Block.unserialize(block1.serialize());

        expect(block2.serializedSize).toBe(size);
        expect(BufferUtils.equals(block1, block2)).toBe(true);
    });


    it(`must not be larger than ${  Policy.BLOCK_SIZE_MAX  } bytes`, done => {

        async function createBlock(numTransactions) {

            const transaction = Dummy.block1.transactions[0];

            // array containing `numTransactions` copies of `transaction`
            const transactions = new Array(numTransactions).fill(transaction);
            const body = new BlockBody(new Address(Dummy.address1),
            transactions);

            const rawGenesisHash = await Block.GENESIS.hash();
            const genesisHash = new Hash(rawGenesisHash);
            const rawBodyHash = await body.hash();
            const bodyHash = new Hash(rawBodyHash);
            const accountHash = new Hash(Dummy.hash1);
            const compactDifficulty = BlockUtils.difficultyToCompact(1);
            const header = new BlockHeader(genesisHash, bodyHash, accountHash,
            compactDifficulty, 0, 0);

            return new Block(header, body);
        }

        async function test() {
            // computing the maximal number of transactions allowed
            const transaction = Dummy.block1.transactions[0];
            const maxTransactions = Math.floor(          // round off
            (Policy.BLOCK_SIZE_MAX  -                    // block size limit
            Dummy.header1.serializedSize -               // header size
            20) /                                        // miner address size
            transaction.serializedSize);                 // transaction size

            console.log(`max transactions: ${  maxTransactions}`);

            try {
                const biggest = await createBlock(maxTransactions);
            } catch (e) {
                done.fail('Valid block rejected!');
            }

            try {
                const tooBig = await createBlock(maxTransactions + 1);
            } catch (e) {
                console.log('Rejected invalid block.');
                done();
                return;
            }
            done.fail('Did not reject invalid block!');

        }

        test();
    });
});
