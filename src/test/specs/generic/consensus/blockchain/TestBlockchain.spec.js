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
            signature = await Signature.create(senderPrivKey, senderPubKey, transaction.serializeContent());
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
        const height = options.height || this.head.height + 1;

        let transactions = options.transactions;
        if (!transactions) {
            const numTransactions = typeof options.numTransactions !== 'undefined' ? options.numTransactions : height - 1;
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
            const accountsTx = await this._accounts.transaction();
            try {
                await accountsTx.commitBlockBody(body);
                accountsHash = await accountsTx.hash();
            } catch (e) {
                // The block is invalid, fill with broken accountsHash
                accountsHash = new Hash(null);
            }
            await accountsTx.abort();
        }

        const timestamp = typeof options.timestamp !== 'undefined' ? options.timestamp : this.head.timestamp + Policy.BLOCK_TIME;
        const nonce = options.nonce || 0;
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
        const store = ChainDataStore.createVolatile();
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
        // genesis block will send the first miner reward to it.
        // This keypair is the one that the miner address of the test genesis block in DummyData.spec.js belongs to.
        const keys = KeyPair.unserialize(TestBlockchain.USERS[0]);
        const address = await keys.publicKey.toAddress();
        users.push(TestBlockchain.generateUser(
          key,
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
TestBlockchain.USERS = [ // ed25519 keypairs
    'Mmu0+Ql691CyuqACL0IW9DMYIdxAQXCWUQV1/+Yi/KHbtdCeGGSaS+0SPOflF9EgfGx5S+ISSOhGHv1HOT3WbA==', // This keypair is the one that the miner address of the test genesis block in DummyData.spec.js belongs to.
    'HJ3XZfRDoPMpyEOZFQiETJSPxCTQ97Okyq8bSTIw4em1zS3x9PdeWBYwYcgBCl05/sni79TX9eu8FiZ9hWSruA==',
    'xSYRx3GM0DPFi9icVtzodvnjck/7qcc/92YTRVXcqALVtCnpK7PZYIYb2ZUp2Y+tW3DHg12Vk/FI1oLUIny8RA==',
    'dNxnxlHjOrthMRIFpWmaNMCccqjXrlO/eaD2g+1jvh8grFl7ZN/P102AYogOWBGZayH74Fcf2KSfy1/rDlFMrg==',
    'JDfN8h0RHx51lMyY29UQcLjQR7ig9URcPPdxhRclhk/Wht9pnUIRXtzYWw742hlaOhJzkuOqqLg2oEM33hIV3Q==',
    'OBZNFtzBjrJwaYq3A+sB0zpGscmYaIHrULfP36LT+5+sF/roKPCiXMcqT7OcAfnNCfzo+x7cxaqcoNEm2+VDVA==',
    'LkC2ULxwljHcM4sFe6yA1eaYHPoPl4j2kh+5qtzPNr1vR95be3os01XpsINXwDHNucuevBGmzyJYbwgcUsFRiA==',
    '2r62ml0RiVd+Wxb/Ef3QsNuCkElNgit6+VQpiPg5Vo8jLY4WEX/L1OL/pJOvLfsnIvb+HTOmCA6M4vpOJRb59g==',
    'kVuy+yezfkkaTRxT47bLMID+JzvyTD3LzQEJTKk8X/RMJaaGSYsDiz68fxtS6m+SSdv1MUSogYz07K3wdr+nng==',
    '8+P/0UlVK/jlFVQBK9Lr4cv4sLXVLiL8T/ahU0wXOYD9hAwqH2/GX7ghf8pO+0AcyBPbBBh+Wy7GgKxFLZ1YdA==',
    'vR8sgRd+wa+n7ymTHB77h2TS91JTvp8pJSH7/c/dZlL91+BMMuXbSr7MBjEPw1rf7qULOts+/zAvnfY/IYsnJA==',
    '1R/x+Mb9PtWkyv3nZpyL1QT19hGj6QaH7cHd0yArZWhl7aiwZ4exu9uX96/TsxgXRX4LA5tZ895IXswXZvnDBg==',
    'aRBGIzF50FEWQoStq/hwKl/50YqvqjSxkBUu9BJ4HVYEZEQdbKu1JDr6/DX8gIT9mC2TQZriK7VNMUVXfSEhPQ==',
    'Uub9Wb4pzoX2cEKwJErP5LoqELtRFeF5BRnW4Y9lZRJNQwmIYnUr6uFb50o2aN4iYlq1s1GsAE8c9gZyTsO6IA==',
    'GfC3EOtTnlMM0z7A8dnwKuA4y1DSIQuwCs8FFRYrhL6lVs4r5QQSJlnuhYjGFSE5m+3392ELkvYNmEQL28u9Mg==',
    'lxFSrIseX4bGZYJY/FrWjEtFZ4coJucoIjab9jc8675mTwkPuB7t7BCmaPPN67WxQFD0Qj5vw1NUQ66q1SrtdA==',
    'zGLx8jnMMGP5T7enK/BQTPc47vuzl+yy07Wcs161wGK0Q5uSlGK6IfF50MRgs1Wn0sNeLqbILEk/KIZUy07erA==',
    'I+zEE/RCxbLOtRA90bVu+zrqFg7nS6MUTn+2f5fbQ3O9jio9dwuFTkrgVLEGe9QbvVGC7NP3bIsjwNvgx3q2eQ==',
    '1Oz7m7esArq2k0AXqHxUwjFcI8DGfR63MUUMuGuvcG+GP7VA5dw5NlR3i2uF5kHEy9wWB64iz/hP9RxXItJAnA==',
    'X/06OWBfaMkHRPjtbzSXx2A1BcrJy6mUl7ndXiqAjK/FHSMI64mJ0VpPR3d8QwphDDUfaHHKt8in26vvUKCUIA==',
    '6krkaWJRA/BrSXjU+dAzRGq9DtNjEEGR45gF0Obyv5elzSSGnO5+VgGItN2StcKfdpmkLFSFm91Na34FEywIsA==',
    'rUjEeM4Hj1xI/GKenLd335fIn4/+wYTqTQB0G6W+AxIzp1fnNY5AMusg8+fab3f6j5DVJDy9OCif5ZiP4RjaBA==',
    'RqaLfBj53rhPWZggf9l7OGyf1QvYazUoHCrep9lKNcn82XSH1cQbTuaGo0YRkpJlSp029uG70LOm//whFGSiag==',
    'YhnMyCfXwdIRcul1TAZbBU7IsASMlC/2Vhmr/gwFjiMi1OlO3DNdnzd70aOHzoYyXSxdtqWGKcEGOn/AtgUSaw==',
    'g2/wZc1CCHBZAajOs0yHBiIj+YTBKf2kFqg4feCj6qNy5yilcUR752g6MC3pV0scZbEzqLzK1kZ5tnxOjbZYJw=='
];
TestBlockchain.NONCES = { // generated using mineBlocksJSON in the console
    '0WONemvTdOwvTGn3dw8RE0LEJ/2Mht2JtG9/4RBCbro=': 52549,
    'Z6pc0kuu+7j0rm5JCWPsncBy0NWecvlY1aCuojhGr3o=': 89506,
    'AKlQB7xQdS9lryPkMpCCqCZUFtiMIJqmn2srm9oAIKY=': 84192,
    'uo9JzW4IaoVpSJdgXFilFl5P4zpkoVNcP7sjoDMpgJc=': 23236,
    'lZzoXelEw2d16Lr4Eus/nUDsu2Z/uUVBFinSuLYwe7U=': 81916,
    'pxPmQVySx7TQHHen9ZLkrtQbhMr7HvV429ZqiVyoTOs=': 49132,
    'NSTlRYvmPwoxnDksgnsvti6XSiXcCXO/gk8Vces0dwY=': 5059,
    'gZyYbxZPmqGQB9V5ASNb/F3VYgahnaNlZsK1Pe/L3tg=': 137486,
    'jGmPJCrlCC7v4Rx8ihaDLrfcxjytYLGlwaYpCvMA4vA=': 18497,
    'VOD/6DlUAB0dfDYmsqgBwFZ8kJ3cVffs4kPNGw+ql8Y=': 16808,
    '0b+JjEusDvSuvPIj5HdfLiMma/k07qX6FcyvsCsZcNE=': 52549,
    'iarGMqWJexSq0UFVvPxTk91yDjq1rp52dNO2su4Zhr0=': 75505,
    'AgO+eSY1n4Z4BbubC1+fWGDtPzf6DDOI5V5DN+PltvU=': 6018,
    '2KDwJuWgkyxK1yDAolV2MwHvaxrFCaKi6EJkcq1suJk=': 166857,
    'FGcAsMTyX1PzjS4Zvsr4TwsgrAE1IIN/SRU9pTm7DxI=': 54613,
    '/tDYcYFVX+xe+abX4f6yct1knY2wYvLCXpHuUYdtMy0=': 29858,
    '90pUhdwKQ6u2uZJ/Un2HUw/xIPYJR6OdLXziUXQaUOU=': 56940,
    'V/JVCXktmbsksLbPUWwrcWFoGuNDlsJBBK2wPuhBiIU=': 18807,
    'OUfeIgHXoUP0bkXOZsmFfktO+ovl5Y1iLU0aRKtiUzE=': 182254,
    'QfJU36JTJY8omlCYklIkM/73FOk5q0YdNZ00rQl4HUQ=': 31619,
    'nSyu/HAeH3Vu5MS9vHnsRY6Jussi5Rg0vqS20VMfMkE=': 19889,
    '2BRuHbPzs0uYkmngY55ocJ1tObbQioJziOLxUY7ZSpU=': 63966
};
