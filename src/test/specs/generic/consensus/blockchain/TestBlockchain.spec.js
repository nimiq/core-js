class TestBlockchain extends FullChain {
    static get MAX_NUM_TRANSACTIONS() {
        return Math.floor(              // round off
            (Policy.BLOCK_SIZE_MAX -   // block size limit
            116 -                       // header size
            20) /                       // miner address size
            165);                       // transaction size

    }

    constructor(store, accounts, users) {
        const thisPromise = super(store, accounts);
        return thisPromise.then((superThis) => {
            superThis._users = users;
            return superThis;
        });
    }

    get accounts() {
        return this._accounts;
    }

    get users() {
        return this._users;
    }

    static async createTransaction(senderPubKey, recipientAddr, amount = 1, fee = 1, nonce = 0, senderPrivKey = undefined, signature = undefined) {
        const transaction = new Transaction(senderPubKey, recipientAddr, amount, fee, nonce);

        // allow to hardcode a signature
        if (!signature) {
            // if no signature is provided, the secret key is required
            if (!senderPrivKey) {
                throw 'Signature computation requested, but no sender private key provided';
            }
            signature = await Signature.create(senderPrivKey, transaction.serializeContent());
        }
        transaction.signature = signature;

        return transaction;
    }

    // TODO can still run into balance problems: block height x and subsequent `mining` means that only the first x
    // users are guaranteed to have a non-zero balance. Depending on the existing transactions, this can improve a bit...
    async generateTransactions(numTransactions, noDuplicateSenders = true, sizeLimit = true) {
        const numUsers = this.users.length;

        if (noDuplicateSenders && numTransactions > numUsers) {
            // only one transaction per user
            Log.w(`Reducing transactions from ${numTransactions} to ${numUsers} to avoid sender duplication.`);
            numTransactions = numUsers;
        }

        if (sizeLimit && numTransactions > TestBlockchain.MAX_NUM_TRANSACTIONS) {
            Log.w(`Reducing transactions from ${numTransactions} to ${TestBlockchain.MAX_NUM_TRANSACTIONS} to avoid exceeding the size limit.`);
            numTransactions = TestBlockchain.MAX_NUM_TRANSACTIONS;
        }

        /* Note on transactions and balances:
         We fill up the balances of users in increasing order, therefore the size of the chain determines how many
         users already have a non-zero balance. Hence, for block x, all users up to user[x] have a non-zero balance.
         At the same time, there must not be more than one transaction from the same sender.
         */
        const transactions = [];
        for (let j = 0; j < numTransactions; j++) {
            const sender = this.users[j % numUsers];
            const recipient = this.users[(j + 1) % numUsers];

            // 10% transaction + 5% fee
            const balanceValue = (await this.accounts.getBalance(sender.address)).value; // eslint-disable-line no-await-in-loop
            const amount = Math.floor(balanceValue / 10) || 1;
            const fee = Math.floor(amount / 2);
            const nonce = j;

            const transaction = await TestBlockchain.createTransaction(sender.publicKey, recipient.address, amount, fee, nonce, sender.privateKey);// eslint-disable-line no-await-in-loop

            transactions.push(transaction);
        }

        return transactions;
    }

    /**
     * @param {{prevHash, interlinkHash, bodyHash, accountsHash, nBits, timestamp, nonce, height, interlink, minerAddr, transactions, numTransactions}} options
     * @returns {Promise.<Block>}
     */
    async createBlock(options = {}) {
        let transactions = options.transactions;
        if (!transactions) {
            const numTransactions = typeof options.numTransactions !== 'undefined' ? options.numTransactions : this.height;
            transactions = await this.generateTransactions(numTransactions);
        }

        const minerAddr = options.minerAddr || this.users[this.height % this._users.length].address;     // user[0] created genesis, hence we start with user[1]
        const body = new BlockBody(minerAddr, transactions);

        const nBits = options.nBits || BlockUtils.targetToCompact(await this.getNextTarget());
        const interlink = options.interlink || await this.head.getNextInterlink(BlockUtils.compactToTarget(nBits));

        const prevHash = options.prevHash || this.headHash;
        const interlinkHash = options.interlinkHash || await interlink.hash();
        const bodyHash = options.bodyHash || await body.hash();

        let accountsHash = options.accountsHash;
        if (!accountsHash) {
            try {
                const accountsTx = await this._accounts.transaction();
                await accountsTx.commitBlockBody(body);
                accountsHash = await accountsTx.hash();
                await accountsTx.abort();
            } catch (e) {
                // The block is invalid, fill with broken accountsHash
                accountsHash = new Hash(null);
            }
        }

        const timestamp = typeof options.timestamp !== 'undefined' ? options.timestamp : this.head.timestamp + Policy.BLOCK_TIME;
        const nonce = options.nonce || 0;
        const height = options.height || this.head.height + 1;
        const header = new BlockHeader(prevHash, interlinkHash, bodyHash, accountsHash, nBits, height, timestamp, nonce);

        const block = new Block(header, interlink, body);
        const hash = await block.hash();
        TestBlockchain.BLOCKS[hash.toBase64()] = block;

        if (nonce === 0) {
            if (TestBlockchain.NONCES[hash.toBase64()]) {
                block.header.nonce = TestBlockchain.NONCES[hash.toBase64()];
            } else {
                console.error(`No nonce available for block ${hash}`, new Error());
            }
        }

        return block;
    }

    static async createVolatileTest(numBlocks, numUsers = 2) {
        const accounts = await Accounts.createVolatile();
        const store = FullChainStore.createVolatile();
        const users = await TestBlockchain.getUsers(numUsers);
        const testBlockchain = await new TestBlockchain(store, accounts, users);

        // populating the blockchain
        for (let i = 0; i < numBlocks; i++) {
            const newBlock = await testBlockchain.createBlock(); //eslint-disable-line no-await-in-loop
            const success = await testBlockchain.pushBlock(newBlock); //eslint-disable-line no-await-in-loop
            if (success !== FullChain.OK_EXTENDED) {
                throw 'Failed to commit block';
            }
        }

        return testBlockchain;
    }

    static async getUsers(count) {
        if (count > TestBlockchain.USERS.length) {
            throw `Too many users ${count} requested, ${TestBlockchain.USERS.length} available`;
        }

        const users = [];
        const keyPairs = TestBlockchain.USERS.slice(0, count)
            .map(encodedKeyPair => KeyPair.unserialize(BufferUtils.fromBase64(encodedKeyPair)));
        for (const keyPair of keyPairs) {
            const address = await keyPair.publicKey.toAddress(); // eslint-disable-line no-await-in-loop
            users.push(TestBlockchain.generateUser(keyPair, address));
        }
        return users;
    }

    static async generateUsers(count) {
        const users = [];

        // First user, it needs to be known beforehand because the
        // genesis block will send the first miner reward to it
        const keys = KeyPair.unserialize(BufferUtils.fromBase64(('Lc7h0L4wncJ3DiNapeGlwURfpbGvyPbuBEpJemzzQW1ng6LQ+/C8AXXbc87dX/VNBrrgAGD1Rc+nXDM7QNFPggYlb56BE4czyOwmIFYPoMmiTRFmz4p/WKhl7hMSBo6N')));
        const address = await keys.publicKey.toAddress();
        users.push(TestBlockchain.generateUser(
          keys.privateKey,
          keys.publicKey,
          address
        ));

        for (let i = 1; i < count; i++) {
            const keyPair = await KeyPair.generate(); //eslint-disable-line no-await-in-loop
            const address = await keyPair.publicKey.toAddress(); //eslint-disable-line no-await-in-loop

            users.push(TestBlockchain.generateUser(keyPair, address));
        }
        return users;
    }

    static generateUser(keyPair, address) {
        return {
            'keyPair': keyPair,
            'privateKey': keyPair.privateKey,
            'publicKey': keyPair.publicKey,
            'address': address
        };
    }

    static async mineBlock(block) {
        let bestHash = null;
        let bestTarget = Number.MAX_VALUE;
        let bestNonce = 0;

        const buffer = block.header.serialize();
        buffer.reset();

        block.header.nonce = 0;
        while (!(await block.header.verifyProofOfWork(buffer))) {
            const hash = block.header._pow;
            const target = Nimiq.BlockUtils.hashToTarget(hash);
            if (target < bestTarget) {
                bestHash = hash;
                bestTarget = target;
                bestNonce = block.header.nonce;
            }

            if (block.header.nonce % 1000 === 0) {
                console.log(`Mining ... ${block.header.nonce} - best ${bestHash.toHex()} (nonce=${bestNonce}, work=${Nimiq.BlockUtils.targetToDifficulty(bestTarget)})`);
            }

            block.header.nonce++;
            buffer.reset();
        }

        console.log(`Nonce found: ${block.header.nonce} - hash ${block.header._pow.toHex()}`);
        return block.header.nonce;
    }

    static mineBlocks() {
        const nonces = {};
        const promises = [];
        for (const hash in TestBlockchain.BLOCKS) {
            if (TestBlockchain.NONCES[hash]) {
                nonces[hash] = TestBlockchain.NONCES[hash];
            } else {
                promises.push(TestBlockchain.mineBlock(TestBlockchain.BLOCKS[hash]).then(nonce => nonces[hash] = nonce));
            }
        }
        return Promise.all(promises).then(() => nonces);
    }

    static async mineBlocksJSON() {
        const nonces = await TestBlockchain.mineBlocks();
        const json = JSON.stringify(nonces);
        // XXX Crude JSON pretty printer
        return json
            .replace(/"/g, '\'')
            .replace(/:/g, ': ')
            .replace(/,/g, ',\n    ')
            .replace(/{/g, '{\n    ')
            .replace(/}/g, '\n}');
    }
}
Class.register(TestBlockchain);

TestBlockchain.BLOCKS = {};
TestBlockchain.NONCES = {
    '54LE5ELlpEeipPeklpufgX93pEqnZWp8wmQaCmdMQ68=': 19557,
    'xikCEgik0kw5HBYzCC5vgjgmwK6+doS2daVrtZHr+fw=': 5062,
    'yXNRG0pPygVQBUG0lwvAADmBbMcrjbudn5jz9IBbQ9A=': 113054,
    'ljAt7IWSy/xNtM+Akx4FxVxAiJxU+rECpmEm3ho53Nk=': 28020,
    'dwmCOKLCKZb7SjH2gitzN6X29F6gWyzqvl2YAZMKrJE=': 111987,
    'giFNDcqZ1f7QrVib8xRDibQbq48MTosgPvLHuIf2c58=': 47969,
    'm/JwRt43nGnVbhe6uUxTiipFePWgFS9xKcbBuUH0NEY=': 99051,
    'CngLJoVJ7gFUzPWB5L5SchxDfY3OJYuLTGpJPrvtCWw=': 20261,
    'Ancssh8gJEgzMk8wLY3jOX6suXWEqhiUxYtA+lsyT+o=': 4042,
    'U5evFgvm56vWEfemGzyJb6kp5Ry6abB/arijWZM1amg=': 19557,
    '+kt6F9GN1bxZkFTutRPe+4EI3Tk5QOOt5Rwedh3rd1c=': 60650,
    'j9kmB2qjJRf09+QOln7EpqaEfejiY7wpc59MCRbUdr0=': 6617,
    '19JDsmUuBuLrgZ9nmPfm911z1A/va1QESnCdPGW0a80=': 258599,
    'ADh1qTsyJW5Boi5+DIGXk0aABK976ubt/P4PFtAeLw4=': 1526,
    '93UlhBI3I8nmRsugUq/hBsP979hmY5+kg1VBe2/37EQ=': 70527
};
TestBlockchain.USERS = [
    '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'
];

