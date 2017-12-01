class TestBlockchain extends FullChain {
    static get MAX_NUM_TRANSACTIONS() {
        return Math.floor(              // round off
            (Policy.BLOCK_SIZE_MAX -    // block size limit
            150 -                       // header size
            20) /                       // miner address size
            165);                       // transaction size

    }

    constructor(store, accounts, users, ignorePoW = false) {
        // XXX Set a large timeout when mining on demand.
        if (TestBlockchain.MINE_ON_DEMAND && jasmine && jasmine.DEFAULT_TIMEOUT_INTERVAL) {
            jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;
        }

        super(store, accounts);
        this._users = users;
        this._invalidNonce = ignorePoW;
        return this._init();
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
        const nonces = [];
        for (let j = 0; j < numTransactions; j++) {
            const sender = this.users[j % numUsers];
            const recipient = this.users[(j + 1) % numUsers];

            // 10% transaction + 5% fee
            const balance = await this.accounts.getBalance(sender.address);
            const amount = Math.floor(balance.value / 10) || 1;
            const fee = Math.floor(amount / 2);
            const nonce = balance.nonce + (nonces[j % numUsers] ? nonces[j % numUsers] : 0);

            const transaction = await TestBlockchain.createTransaction(sender.publicKey, recipient.address, amount, fee, nonce, sender.privateKey);// eslint-disable-line no-await-in-loop

            // Increment nonce for this user
            nonces[j % numUsers] = nonce + 1;

            transactions.push(transaction);
        }

        return transactions.sort((a, b) => a.compareBlockOrder(b));
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
                // TODO: This is harmful, as it might cause tests to succeed that should fail.
                accountsHash = new Hash(null);
            }
            await accountsTx.abort();
        }

        const timestamp = typeof options.timestamp !== 'undefined' ? options.timestamp : this.head.timestamp + Policy.BLOCK_TIME;
        const nonce = options.nonce || 0;
        const header = new BlockHeader(prevHash, interlinkHash, bodyHash, accountsHash, nBits, height, timestamp, nonce);

        const block = new Block(header, interlink, body);

        if (nonce === 0) {
            await this.setOrMineBlockNonce(block);
        }

        return block;
    }

    async setOrMineBlockNonce(block) {
        const hash = await block.hash();
        TestBlockchain.BLOCKS[hash.toBase64()] = block;

        if (TestBlockchain.NONCES[hash.toBase64()]) {
            block.header.nonce = TestBlockchain.NONCES[hash.toBase64()];
            if (!(await block.header.verifyProofOfWork())) {
                throw new Error(`Invalid nonce specified for block ${hash}: ${block.header.nonce}`);
            }
        } else if (TestBlockchain.MINE_ON_DEMAND) {
            console.log(`No nonce available for block ${hash.toHex()}, will start mining at height ${block.height} following ${block.prevHash.toHex()}.`);
            await TestBlockchain.mineBlock(block);
            TestBlockchain.NONCES[hash.toBase64()] = block.header.nonce;
        } else if (this._invalidNonce) {
            console.log(`No nonce available for block ${hash.toHex()}, but accepting invalid nonce.`);
        } else {
            throw new Error(`No nonce available for block ${hash}: ${block}`);
        }
    }

    static async createVolatileTest(numBlocks, numUsers = 2, ignorePoW = false) {
        const accounts = await Accounts.createVolatile();
        const store = ChainDataStore.createVolatile();
        const users = await TestBlockchain.getUsers(numUsers);
        const testBlockchain = await new TestBlockchain(store, accounts, users, ignorePoW);

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
        const keys = KeyPair.unserialize(BufferUtils.fromBase64(TestBlockchain.USERS[0]));
        const address = await keys.publicKey.toAddress();
        users.push(TestBlockchain.generateUser(keys, address));

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
        await TestBlockchain._miningPool.start();
        block.header.nonce = 0;
        const share = await new Promise((resolve) => {
            const temp = function (share) {
                if (share.blockHeader.equals(block.header)) {
                    TestBlockchain._miningPool.off('share', temp.id);
                    resolve(share);
                }
            };
            temp.id = TestBlockchain._miningPool.on('share', temp);
            TestBlockchain._miningPool.startMiningOnBlock(block.header);
        });
        TestBlockchain._miningPool.stop();
        block.header.nonce = share.nonce;
        if (!(await block.header.verifyProofOfWork())) {
            throw 'While mining the block was succesful, it is still considered invalid.';
        }
        return share.nonce;
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
        TestBlockchain.NONCES = await TestBlockchain.mineBlocks();
        TestBlockchain.printNonces();
    }

    static printNonces() {
        const nonces = Object.assign({}, TestBlockchain.NONCES);
        for (const key of Object.keys(nonces)) {
            if (!TestBlockchain.BLOCKS[key]) {
                delete nonces[key];
            }
        }
        TestBlockchain._printNonces(nonces);
    }

    static _printNonces(nonces) {
        // XXX Primitive JSON pretty printer
        const json = JSON.stringify(nonces)
            .replace(/"/g, '\'')
            .replace(/:/g, ': ')
            .replace(/,/g, ',\n    ')
            .replace(/{/g, '{\n    ')
            .replace(/}/g, '\n}');
        console.log(json);
    }

}
TestBlockchain._miningPool = new MinerWorkerPool(4);

TestBlockchain.MINE_ON_DEMAND = false;

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
TestBlockchain.NONCES = {
    'ATtCeswG5Ka5adeIhV8W6kSzLNBWlVdh4gLODNv9jEQ=': 21728,
    'vY198ptSJ5udQS+KcrH0YtaEJoz6TnfU+ch5H9DEILY=': 54184,
    'ZPOjUfDY6yUqLTo+9uLtiwkn9tGhGXn1bGdrpwnnzz8=': 42109,
    'OWck6ejqk8DCct3UTZ5zja/3zF7pfCnycfCCiG+hq7c=': 65140,
    'YluIY+G4OQiODbNx7zBNJ2GOKL1ZodR2M5M+j0WHlhE=': 34502,
    'ijrnQnCKLl2nD/yEl2EsvH8JDJPtrkR+mfykofz8/tg=': 77059,
    'znXh6DtbGg0gAtCB6j5tvtS9xrYjdSF4GdR9QLXvjI8=': 146810,
    'nKVOUJWcDg0lJOtMWkQ1wg4sBxtKewnj2IfrzrF1zbo=': 38311,
    '/L7a41c8EXLek9LMVeb0xoJno+mYAc9jF1zzMgbV2YQ=': 85914,
    'ZmjI8a7NfJHbAak9VUDHcwDSVClueJdFbaG+kidNhyA=': 28600,
    'XuOdBw9rRNZypyx8/mneDRIuoMtXuVoM7c0mRUmSA1s=': 159905,
    '1rOxb4mPp5Jv1v7QIWqcsLbroNA3HW5RAzlUpWn+5hU=': 46208,
    'w6DCoVBCUe4IRUN6Bnq+bPghL4QdXFiGDYgESfhPakE=': 57532,
    'agiHpSkvXVYcSCcVFFu9ynHI2HtmmbrzsowRhOYzyyk=': 21452,
    'RQ/E/AG281od3bjuDoJjtygzZc/7HUJu8MXxe9fCr3Q=': 30505,
    'ZuGQOTQhKM83EbwONX2kf0SymkLxU8H3HHyeKD+Alng=': 36858,
    'M8KmuO8c0dbKWOzL+eM4bR8XlXPZ8Iaxsp5k7U4A2O8=': 45901,
    'z37PcbIZOCEwemEuYHJG9nR8aRE09Ms936WMttEKZMY=': 49241,
    'lbk43eGccJhGncf3Avhxac6hG+nNJEurtt/x1WJ3V5k=': 13460,
    'CVGcQdB+vh+nAZsv76VGRAL5dK7a9u6LqVA0jj6fLB4=': 29474,
    'HSgWOfHLZ3dd43I0XeX0cb5ScAWVN6ABkcIlq/QXZuc=': 102319,
    'J1hKhgC8xAc2VZ69g7qSjIVc/WTrcJWCmPXBlX58x5U=': 318684,
    'vd+Em7dmC9LENSfxKtAkmmVzJoo5flf4FhnwfN38eHk=': 112305,
    'N/R3pzomZ3g0MRGz9Zf/HWJem9WGMv4fr0AkqnXtXn4=': 100494,
    'emiDeuux9pEWzsySG1W2bbvchSZeZfdG72wEyJv19VU=': 22144,
    'Ue5pSyDWcfZrM79JZGC9aYsN100QOukr2lsk3sft5IQ=': 142775,
    'ahQ+KbVV5NyQZiKxp4Gq8SrK6eSg66yCgZVET1VrWUs=': 68127,
    'EcDw7wsQZ10dlfMeEeZkfvtPseVYxKRPsCrMNPfTDrk=': 169209,
    '7Qq++sXASAKJqGRdShnrdCRxzeyFpnOi21+6j+5TlGQ=': 14755,
    'hGoGq7EnlqaWN8OSRZS4C54kpNUA6mcCkhlTr1BmHcc=': 141541,
    'x0VHhGRocIxz8dwGba9NeAoLpAmmtZkDm745Dhhj5cA=': 19632,
    '8l5eILsFuTRcB5Yo81WX/OgdSHYCsG1vmIdgOhJK5x8=': 25847,
    'vQjleiRElrT3UGV+csmNHggk+DDn6TRVrPfWllQ5SiI=': 5102,
    'mt+CnzEDoFiJ4E8ZITtHNyRHPfYM6CVBqRVM7NdW/TQ=': 11059,
    'DApElStsi5pRmHt+llcQF7+zBc/VNtqDUIfYXVT/0Uk=': 150334,
    'kdGzlheVvM5DGuSiw7RJP2JSfLNJ8l2udVq9GwdPhvY=': 20815,
    '8IU+ZwjJnSwbO4yS4rc5/rrwkqZvWPaK3bndIpaGD+I=': 126328,
    'zjKS/4TzQEm4YsngSqswmnacKf6tmAhkFM3JOmW1pBY=': 242260,
    'II0QBCPHijWRrmM46I6FFe1JowCgqUdX6V+cMxgZm8c=': 21944,
    'JZ1u/YD8AZBsRWQ6HKrl77iW+91I2bkqv7O9JOFjsnM=': 4918,
    'ZvejzDjra7EFQt0t1xWDB2soTGnEv3kulX6UhXW3+1E=': 161166,
    'ughoosGLdiQM0EomnnUqDvvqgIPt5+lf66wo+XeiDek=': 9853,
    '/rdJa3h6xj53+nVYycmDX8qlmatTr+wNw9NqplKMVFs=': 28702,
    't0MwkO/HxsONbyj8VtP4QQe6/5YbzzV8Ak6ZdVWyn9o=': 20606,
    'zXhpjHTmqs3sqKcv8LzKtZu2QTIZGKEUXwyaurNOI+8=': 15943,
    'mbv/fYPDasYTQQTa+dajLCN/mU1gqF5GHjkdZAmL+fI=': 100874,
    'ZoY59aG2cnbq1XcqdKokVWc/DYi/1cCxKOkJoOwqqJ4=': 150778,
    'G7W+QHjW1oSx1rqiU5UxLRV8VH30MhZi3xF1weVxaSE=': 46936,
    'P/hAKiE37dclkW8jvqI26BHkbKarIsZsnLa1xjt3C68=': 5033,
    '9PoWM/m9ne1sOmrmvdkhtCGlHEQUQOGDe02we2TnyGM=': 215465,
    '2mkloS03aKT0DhGre0ICq0h7zImJ/ww8oX35TxWA2RA=': 67524,
    'IkMft1mtuytXp2wUwVrBQkaGTYpkOXl45arDC9EkICc=': 35501,
    'nTNCEEz6fKcai1m9TpDhZJY30gKv38C7b73sWLRsytY=': 21073,
    'qDkNuj1BuR5Z2vEPl4yIceP1crTBz689GOs+wxRaHl0=': 143091,
    'LHEoocivH/VbWG/0ivg6zsZSYkJ85lrDFN1nKW2zVzM=': 6582,
    'bfVLFAdjWs6kzLg4nRTtbAW44Qv3YlZOeXCYXNQDQ+o=': 56729,
    'M9fUTiQKYF/x6trmgbYcheY/PkS9ESZMy0R/7J3p7nA=': 5360,
    'gQedbRie51F3JCU6CKQR98GrypbvLXy5BxHbjU+PdAE=': 103898,
    'ABm6SEeVSPRJzcCKxGXd33KMZsH43pJfBKKiQpmgDEM=': 69475,
    '8gMxcykYjnKAZp4mMW7ubKKtnq+CmHj/oOu7NGb+6C4=': 23249,
    'P6q05Ybju+A9b4g/zjxfjJD19iC/o6oyazfDgDwLwKw=': 19209,
    '05qpmDXDl7zknIUih9zBF7URp6U3Qe8xT/5Vdrtjrsg=': 12258,
    'jhetmnsa0w2L3td4C7U5+uHDsCnwGP5V07q0BBp08Ik=': 32666,
    'CvXXX/RF0/byPF3sX9q1j6MxR5FenzR3R7KDm/YLCQs=': 113945,
    '5/bpLlLs5JnpHtuLJiKGEdBQvzL+DtoTLV3vq8b0t0s=': 14303,
    '27FoY+f7PNstmzLobSbS75A8Y/xqnr2KJcPA3jauTb4=': 1003,
    'nc4JsIZnwp9MaUapYQnGcTb+Gxg2849xDFdjMioupSg=': 90081,
    'g7JsmARek4WaaVbxQiT4W0y9APGKnQ+SpwLBCmTt8eA=': 12513,
    '3VH6hbPKKJgMw4Y5FA/7tXxt1z7FjOybttXoCRoyNh8=': 29488,
    'PNTNER4IWwdJyxRVrREPYjb5L8/TWW9r0O5UsywLf8Y=': 86292,
    'GeyLRoL0RGUwLozU8zxXrPfpub0r92Rthof6Kf4qZsk=': 93418,
    'x2m0PymgMxL8+x6vTvYZH/Y5l20H/oR2WZnXGLjANZU=': 3115,
    'WROQUlgewBjoOotIDhlUtqhMiQGrlx7GbuIVH7M/fBk=': 18605,
    '2nc+vAUDLA3B9oCBXO/d/e7thV4ZsTHFsGB1GMbZGcg=': 5920,
    'bYpcs1m4jvD3jRpPDGjwi9s8UyGaj1zx/JDTH+3PrUY=': 9339,
    'uf2HOcZEBuxu5BQOShH57q8yvQzDbNI850CfTW0UHZI=': 12006,
    'BkylQQcDhb024zNHWvBCVj4l6gZsgkfpI738RjNTmNo=': 19229,
    'DW+HG21CYxcI+K+uq4Q4M6AmPz8L7iRInhH2u1HWZ3A=': 83899,
    'Usrqp130QX+oYtIZfEIcVdxhkjSLuWjuHUXL4EWFWls=': 1579
};
Class.register(TestBlockchain);
