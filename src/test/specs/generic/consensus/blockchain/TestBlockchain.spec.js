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

        return transactions.sort((a, b) => a.compare(b));
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

        return block;
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
    'ijrnQnCKLl2nD/yEl2EsvH8JDJPtrkR+mfykofz8/tg=': 77059,
    'ATtCeswG5Ka5adeIhV8W6kSzLNBWlVdh4gLODNv9jEQ=': 21728,
    'G6Zk65Nwy6xuoGvg5VXSs3v7bS9szNoHeDWViaGFoIg=': 52184,
    'E2RhR1h2u05EQBjh/F4MVYCzLp7IfJpT//Enls5WYDA=': 65573,
    '1kBrGpH2V91oa2HCpWU8I8RE5izshwg/VUQGfvqlVBo=': 67441,
    'E6SoToZYYICtrFEnf5QXmHll18iDZYcdMIBUH4x0DR0=': 22502,
    'rSZAIDFsUw61eTvNl7rArNW6/jbLsL9vnvsApfND+sU=': 117488,
    'OomKSalfQK7v55MqZ2KdUR8PDagYl/LG653pWymML68=': 30943,
    'H1CGrdXGBkE+7IquETv23OPkOJaqiUVYGRh8MO50PVA=': 145238,
    'wiCxEQJnwwGJf9mtKd3zjC/3n9nevGlSPjpKbyPuHhs=': 30027,
    'wG+/BDz0gvMNj5DPzCmet51YAN5mhRID8HTJf0/+OVY=': 48666,
    'BIzlbOCh0KiRUF/UHnR+yOWAJAUamNN+ffqHdHmI7z8=': 199047,
    '4vwMeSb3/rI1eKNcpzfXQXRVMl2FhWtQUO4KufbieYI=': 34293,
    '5ArYr3g16gcyOKHuZ53yYltqHWPtc/YKpyHmItMy5LY=': 132,
    'q5ZVpugSlVGoamuPKqndKPzJwLjqKEU2T+7TC/MEZ9g=': 30568,
    'ApIt9UhAS0o7LK11IiI2GzRxcL7DA1QBOgVuskAJzzE=': 80980,
    'XnYdFT9e68NHI8dSjp26cJpvP5MVCJPvW6DE9sSV+ZI=': 197109,
    'zyGFTLSARj3tgDOKxANTAtzWwHy4m+DnKXGP0NDzYk4=': 36370,
    'hiedncFf4e8PE4wZblzzXkzi50pfWxG/MrSBYwUWdeY=': 298,
    '8SnVIItOhrcTBdCL1LQpI44MzBK/navYl+y0rOc7mBY=': 24852,
    'QiwY1VHq1HGXjmXGmtbDoSZtpCp8D4/BIvZqKHanvos=': 39428,
    'xCC+kWSpYPi2quRG/4gcIxss48oCM3GaPJIr8vlxdPQ=': 66116,
    'jxbBYI5ZqXbGLKoJe0L1bcJIYUglhC4fipe9MBAVTyo=': 74746,
    'mHQg2X7S/M0/TP/pqZRAjWvd3cmbOl3IjVCt3nkyCS8=': 61283,
    'IdmlOGmchgYxoGIuXx+osy+b4wZpgl4Vp+3rDfrVAVs=': 84097,
    'qsW9xsxaw0pcwM9UKlhkdZqZmyD7fsmBkI569nn2EJ4=': 23846,
    'GFLgozEZsamoOYnDkl1UmrnnZ/cZFz4yo6zc5djXREA=': 35241,
    '3U8jEH63a34SigDUxpcyHo2eH+fnAxfvI9Nip1Ze0as=': 66303,
    'vlFxRLPphQ/4cHqos+9IjaEFtd1/ZlbCT/DKz6AMaKI=': 33371,
    '10HW7TpN2aKYeAU+ecPp3PcNfM7ZCQxzCK174AgqAu0=': 90959,
    'e06TEIXEEX8cRfCxUeDk1rxX3begK0oUO70MKpsTViA=': 38814,
    'Hez2QOw8bZqb51Y3Kg65IHwa8iFMw0IV52BzKiv7wQA=': 30824,
    'yW8NUmHtam4PdBfVbXUNELO8GeRiE7aTiykz1ZB0aZM=': 216845,
    'O+4Dml9Sdu2mPo3eCcF/FPbo52covVqbpoPY1vgOCWM=': 10372,
    'X6IN7eAq8WlyW4fzLrJQkn0JFxm2VfW7sHXJfLMBoUg=': 12658,
    '7okyPzeA1KUY2i9S25Vu570QkE+9tsHiAwYr/pw2PVo=': 78195,
    'MXx1xgUt4FPG5B7kcvZR4yY608R1VecHKcuJCVI2/Eo=': 32639,
    'VzP8r/PfCmgY+NhlSazidja9RXZlWrIhQ/BKKzQ57dk=': 106922,
    'C50Ea+wdWeY8SqhUfNadUaBh3EgCR/OezN/tcxSPEF0=': 22434,
    'rO1Wfds43npX2vT/au4uj4ADKQqKnTi+HOBiHwLtD5Y=': 2940,
    'DouhdPHoXU1uemycAn8uXs989EKAjLu3yJn7ICVbcWU=': 34065,
    'o0R9I9EBMULcjh+O5741H3gPIhJOC+xgT5m4jIeRr8w=': 8309,
    'CPtpvkIgY6XX/BfLKK977gSisTB7CXBjOxjUaVegU4U=': 37642,
    'DLOizykqTz9otFwc3YOJR7Jcr7kR/VQAu6iMySXzQ8U=': 37909,
    'gcP8XCamT1m6ex5PPN/CaF4LB+vti+UcrYYCHNCfT68=': 525,
    'YmOgU8YQWUBlSHlr+ctNTACTgXCjMl7DqVFkXtWnhxs=': 66922,
    'kXcoTZWzxhqElLID0wWVJBbbxppBTNyNbHkdR1pWxAU=': 21413,
    '2odi6aAWPHK8IosCU6YsIRPByne9ZDH3W6pEMTE6Hhg=': 77056,
    'YL09bSOBsB0CxHDVmVHMi8kF6/NyYT7u0CJy4k1kZjg=': 192011,
    'bd64yh+X5zFEeOzavf5HKuHZnyEbdwqf+68sDPbjMOY=': 6602,
    'N2JWA87MvgZNOEfwG8qWi7bK/oNOLw7Nap5w5fuI98I=': 10586,
    'Jhu8IonB1+We/PACUpWLAe6U60Lcd0iAndr7zpr/Gpg=': 28121,
    'T94ovpdEx065AvgD1uLDfl8umSTtea+axTNtBQeoD2U=': 36052,
    '8PdX5XhA+vFqAr7bY7uwivZ3UtVs8b3chHlka7hUrVk=': 3493,
    'YOIlUgGXr4oGMyJranMkRvhL+6qh74vXxGK0XuMKiOE=': 53897,
    '/T4Eegf4qKgEenGaRCFNFJKg7fClhRWeMcRWsIOLFPQ=': 77960,
    'X5c5qkg9/QujeufvcP3/UENtX6WBmJhaieArppMOy0I=': 26915,
    'QOfyXghqgYj6dDEeu+ReDZ0DNzkEJHMSRr2nfgWer0A=': 11405,
    'J/rTGnnkoT18xelLy7yiNVvN7DXeOIDa4Ez694twnw4=': 189320,
    'fBKdBjTlcYZx47rrBcxJjdyky9OoMfZ91BwmnT4T7MA=': 11528,
    '2IZ384a8lwPTRp28VrNVGxNNw4bSpuDq2uzMeJMQkUY=': 28288,
    'Xd1rPmXs5yCVCHdAjnvJVgSYI6xubGPce5+mm/SdAH4=': 6379,
    'PJY82ebEczJd0ounPMT0uAdVILMwLl7+m+19wn1FSxI=': 144681,
    '8bWahoiplhZ6ydV/8xF0H/Vh/ok8sJ0Esko0sTPuyeQ=': 13707,
    'j+b/qzZHi6TQNsAMhNeKFwxsQgU8zNMPXOIwpXRKF/U=': 74094,
    'Z31o2jDYRm4nkoTa4VGNkIubDNq0vmPa20S4RvgHmkY=': 74295,
    't1RhJWTSVBw2MSYvCqaIn6Kw3BN+UJ5hRgcyaTx0qXc=': 76673,
    '9tXnoKbsWb05iJEqId7C1MW38XtXesUlPJ7JG6xxk/Q=': 49793,
    'Nt/mx26h2aTAIbmWUSXvhth2CdD3B0sUFzO3BU0in/c=': 86322,
    'bvdJhTrHG/kyE/M/+UthiJ+VzZaFjJoz/EpAQ+H2mDY=': 56347,
    '9+9giYfKqE8mg85sECU/6f2WakKjZ0R3XyX33cLKdc0=': 57317,
    'WGhzwqaJBt6g4CQdZSp0GEgK/BhNDgnUjDGLKgzVNiM=': 73423,
    'Bd1scef+RYzpOo7C4U45hmdxaEk0eeXiwrtQ82tkBDA=': 5796,
    'FihBPAETNkw88KcCNcKQPFz9Tq7GLA/l+3z8YbVLkx8=': 40599,
    'trafLxU4PhzLcgsJC2EM5OEWMn9h++Npg60drHjK0+A=': 18491,
    'kh51kFpaRNr31WCUbPzCDFkU0Me/AbCk7lDopxvFpgk=': 2560,
    'pwds7Z0zEgQjvx0OHPniY62uOh7kx4Fv0uySvac4NAk=': 48877,
    'DRFt5h/KQpHTa7YA9aThi+NeJqkKFMA2AdiIKkf3GkA=': 74692,
    'jEcR9373y2oXEfTqjoJzfgSsF8ILPMBNLoiQOMRvwHo=': 162207,
    'mqFrGDpSWSqGe3E2PpQ3NsRloZWX3BY/gDPR242ycz4=': 59032,
    'wzFtLSVqtoJ66IE4sniWu8FSMaXdQX2CtxmwvvrdZG4=': 67525,
    'kKinACyUUGXcLj211YngGZyaS2oitPYq5eHM3MoIqDc=': 34038,
    '+Uri6KOCCPI/VSH2cB5YMKKGjfuARq7FhYhfoAjEW/k=': 15994,
    'UBNId8vx350XcV6XKnGb1fojq5DoBXrf1apC44EOOU0=': 29330,
    'K8QA+X+URMydm26ToDbf5I9cM3WRyxc7dP9TVR3tFJY=': 48368,
    'N/7yzxvtG1eYxdM0IASrjzLUZl32i2c2XETa66goQMo=': 131046,
    'XHjxzhUExklHsa0RZApREi+DjsW/zT+HjWBLNqajOy4=': 101335,
    'FMAg19Vo6CYqFSwl45qG+HSezqg3pHrjovFccIbGKtA=': 16330,
    'WAtAXYiqved8uUiZGn/rbATpVVic8NSTvAqlhdrFCe0=': 34785,
    '6a9aRXJjn9iRNtKLqsvtPnkTI9oN6OmScUu+RMluGic=': 38517,
    'SyeB8H0ixOEBEBmPFopMf/VmIhZ/6Ns2wrdKApYq/2Q=': 54978,
    'SMjfUjeQIsMk4wpSY2RhnoTufcdztd/UqSL7t+Cel5I=': 58956,
    'tNA2IwJ41JeDQhrz/aTDkm2Rv5mCBigWuQkP4Lo70ks=': 1270,
    'r8kwFWN+Oeh+pgpnF+xcGQ6LsW4BBHu6CTgv8OfzQR8=': 6028,
    'CKuatg/5B+UyslMoPCWLCxXnrft8kkTdRzGysw1sdo8=': 6801,
    'CgPQuWUEZS2RQT6KqmVC0V5g1TCtVlOh8/jHSHmwExo=': 22805,
    'wI8ckyl5mLtbSzfLMhgLuKEeY+SSIF65cPuuR06wxRw=': 63250,
    'WAAv9r0JjDP21pvG87BE13SQFvSD885Epo5qCQwgw+s=': 26667,
    'LHTvTcEcgpl82zzQ1+JMa+hkvx9VDEUiq0ZvvWVpP9o=': 628,
    '7O0VS6dt2VEpotK+t0gjaCa6A96dxq/2DWMAbuVvc0w=': 42965,
    'xB8g7DhMlIrNVuxUs3N0/588hmIZ7jKxFczdqZ3Kqaw=': 61837,
    '/lqdDj6hLr+80Y19HeYTKUth+6Abegvz/z2xgwKWMd8=': 37260,
    'Yp2SxuC/axf9Stxi0WrxFtidCRswU0Zt7VUoV2T2tSI=': 28078,
    'qxuUbAvtQWgP3cGOuCbVkxJdslOD6SgBvr1LSjX3+II=': 92602,
    'BaxkOSZ8lIDvqBKy72tBNEZn1/NMw+BNhYmr62Qnq8E=': 66801,
    'Xh6v3rxlErGpppaxN1nzZz3eufG9raaHIEhrmMbES+E=': 91836,
    'STWKJk3rap1H4QUv5ArXAM4pfXLex6Ss5oh6xLaDaMA=': 7639,
    'WCUz83TzN28xCsXu+8e7qa2T74+eXOK6idKLhr9YQmE=': 37594,
    'y0xRPAofK41TzPkV9TyG1lFu5u9fC3rdeOAfWObiOK8=': 24009,
    'eRn+UwVveQpmIZ1cGB5mL0srhM9FTcwN4Vbbs+1HxxU=': 45787,
    'Rp8JLAh/FNi8v7wBPrJTppikLzdm1lMe4KrnXrjqMc8=': 13521,
    'jZJ4nrXRp63s1BvGGQnolWpevHHH0oeE2H6P7sug/JQ=': 76485,
    'FcDiizhZMSDUjAGL4sEJe6CUSpWPyQS8GzYd72iM5/A=': 4318,
    'vy8iATBzoof+XJxn2UXEVlbxjNS5gQ8gbZKz5JrJu04=': 105633,
    '89g2H9kmGdri9JOBHvwDRD6t13kNO7a2qe4b7WPRHV4=': 30589,
    'mk2NzR9qkwHsMsDTTeu/0hfdhWlKFUMBqqiiplosVVc=': 130430,
    'AfB1pIe4hWCov0KmZcNKtctLJFSJjlgA/w3Cqjr3HY8=': 160774,
    'x2+n4sDVp+pnmaWiPJnm5nPbCwxbHflnk9reTN1mfgg=': 5166,
    'ISP6VaNhYldlhYYJv11VSUjg9NqpBZqY7qyBY90aEmk=': 39517,
    'ESIyJej2tS/H2DSGtzpwOZgw7VlJSl14swEHz2N4BRc=': 46326,
    'nPhOVg46zTLq7wdhTqTmNJWkPy3xD9+R68OuqagnSxA=': 130913,
    'EIqvUUiyZYs+FVmru5gRfWqa6RZV76RS3RUVKpZAgLk=': 85705,
    'qO47uWPt5qGaGlKrrfo7EifjCVzelx8u+rwiiRseOfA=': 45406,
    '98qD6UlEdLy5phyMBglvXDpkOblQfGJcVm21u1ytdZ0=': 40649,
    '4v/iZD95FG8A8T0mnNpjxh9LGaP478uZeyyUKpmQJ0w=': 47251,
    '36aC0FD6BSl088SlgeEFbKspcNohoA24IzC0R0RusHA=': 47208,
    'Xjh/vzup8OR6KnGyba+LHgralNQgN/7km+M3KBLhqtI=': 89571,
    'LwGaeaas7ke8MPblUT9pmBZ6fbVr5tBbEf20zwXwaGA=': 92529,
    'McLzuIHhOSGF4ODpd4BEMc3f0Mz9HeTJr9NuwIm9dLQ=': 50347,
    'yLEoVrBxlVf3oCv/vuA8GsHDWSSHKNUure5+SHmkPeY=': 185839,
    '1hxvixLE57raV+VPVrUuJsfcjrkO9uADY+zYjsfo2t4=': 104755,
    'Kerfwd5o3c0aW8tZKycof+5gi8WChKm2+yv+3oRyzRI=': 122030,
    'N/4HPmP15tF2DUIOmPUay0LuIIAN1d9YzEy/ZWlwhAw=': 38486,
    '2PWT2pqgcH9HO9S+esOmOTSwrNWlVTcdppO9VsS6nj0=': 14165,
    'JKNda2qhniuPPYRBvypsZYa2KiyAXxjnIZmnM15whSU=': 43064,
    'jkoCY0tqLt12qXkOp0jvhALGqb8F5A277/h8n8idq5E=': 12823,
    'GGM746LTvttu2/cxdcvzT0NaTW3kNVPP05ttsKmN9yE=': 66251,
    'ULEHoqZjW9xpO4/T6ZRgKZ5IIGlLWkwi0IKkgyj6cTs=': 114847,
    'ZL4QeBMbJio/4W8Bfbs2FhcQ1Y7MG73sZzTe1IhqpyM=': 172061,
    '0DvmGBNb+TRJLiXWy8vQpvDffz8ZGckCGG8iILGe4Rs=': 63146,
    'A6R/WFWa1hb0AspWQR7tZNtYUN3d0qEopwa169vo7zs=': 323,
    'Ow1K9cDXwDAbs9D2F6Sbtj0nIowv68Z7qrgmKS3cOZk=': 45028,
    'Gji9lpMHL8j8M5gB2MoFgzNVvGnqu2OkMPecczUQXCc=': 163376,
    'NpJDOmpATx4cworRH6fed8nsSzEwOdkrSNn4JR9/zZ0=': 113417,
    'WVMxRDB2hODdclOBgltnGFENzjFGhzZVGXT+DTzAFfQ=': 18813,
    'BivaM+ZxNJJB+kOXncRRr/xXYwZRk97GMclYAWKU3eM=': 6267,
    'RuqE7df6LnDcTzFofyyltYm4hyj+HRFVU3dRGxWR42E=': 814,
    'wh06l/J5ICxd7uRO52ETlDP2cdvkzKooJCwQZFM8XiM=': 152171,
    'hH0bYJQ91En5Ep+aGwHSGKX2udSpwpuxG+j0sV47eFA=': 125509,
    'byJtWUdBY9ARUP1LUPJTrjk2N5joxCRsQ27/8SCdURA=': 7779,
    'gTB1z8spjWzBTBwOGXJiLlxvxpO1gWoZUHX7UBMtskk=': 115335,
    'xvAIrbegavgwTKep+yeQgXMdwPe8q9fyBuVh+ATae3Q=': 58064,
    'Yfo/lI/isTTAF/jSvzfk/fEsmE9kTW4te1gRmhXxtus=': 9488,
    'IP7bggbJKzSDhMf9DbxcI53Rirn+SES4Sw47K5F0mP8=': 56564,
    'VGWygee3h6FYna0evkm4E07FxrbKfgFguzovjRpFy88=': 14277,
    'aJrDxqwEAPq/yJ02MkmKZ38bFkiXC2W1kAV4sLqUJZo=': 5637,
    'EWACWB/Lgay7/ehT5mY7xxFHyKonbQ52jQ9ULLOE6U8=': 119243,
    'H67H0uuiyC9NQDun6qDYfCXs2RneLQxdec/1OgA4jzI=': 1861,
    'W4xrjK1rj95RWEvzWZS4CR9n4yNPja+XyygTyLZ3aHQ=': 52047,
    '3KZZzUrHhxv+a0H0I445o8faMpBth5ZsTBbLz9XX8Q4=': 372815,
    'BdSx4rUGOdztKA9hCnbJK2UKaziPVOYkRgCjYvfFDq4=': 101955,
    'p/dm1bpxv3WRDtXL7ZY/6J5x6fxpDKBbk7bHFqp3Et0=': 5484,
    'gVF1mXtWY3QsUVae2ejVy3GziEmypOB6jpzEPJAgcVw=': 27899,
    'YUzkc1LI2vvZkvFeFqMebhuwgjH3SL73A+TwHHjbGsw=': 5176,
    'rMAp4trjjQEkfcBxR+ozwzKOG4rV/7zgFTM/8mtjzSE=': 22949,
    '4H8dEuYkSJd4FvfCI8XsROFEsxFrmbRp+Ejdv+UKa+M=': 97037,
    'aCFYx8l6yAeYdzMBBE5gAh3GlWY4BZz8se9A2E7DiaU=': 69053,
    'p0vlfIwohg4xcUbBA0n78v6ICnqTXlY8/AlKC+G1i70=': 142541,
    '/q1DkUvGdXLf+wOscq/wH782HR2kW+P3/osMZFaXcMQ=': 289949,
    '2efKkQmIapJJYww/eh0SUN7jhsnupLOOaidgPRJppDk=': 11988,
    'aibEVhVb+H3sRcwGT7+p402ZhHVAwuclwj8/r0A8Pj8=': 56564,
    'NCPxgBlKiqfX5b9ZA3u2+DSdfVdRJUsQYWmEpKSW8iY=': 128480,
    '0Vkl7zvQ8n4Ftum25oPWYEwNxlkdlQGBTU975sRQz3c=': 45733,
    'jNy8/np0CgnWDiI4J3no3rjln81XDP/P4xXeyZ7oYPs=': 13040,
    'w29TLdtt37mv9ZlXdwpA51tMEVCOeGiqlIQ+E2/3Kz8=': 122646,
    'TMG9dHZLR+Mvg0ZrwAtu4Pg8pO0H6XV9gZJw9PJ1XxE=': 27144,
    'BtLdjQNP+QbSMBV79r4udWbKtxjzfuAlj4EINbx06mw=': 14504,
    'HuNCNwed4GF7k79kwVKBuTiZlv6/0eDdhhCQBzkB8Eg=': 34913,
    '1UKRDCPEul01eoSeKdOMJKqhSJjBPnz/7y+jqlPJrLE=': 15816,
    '2Y7lFYRcUntW1ftuYmCe2I7vQGGIeltp8xqbZAQ1w+k=': 37239,
    'cIVqojNaErq+NslE/nFYfAww47UleK2diuLOdTlP+9M=': 17279,
    'XP5KZsZ2NNnXmNcC4Ex9HhmLbcbI2HjEgcsFvjHYDPo=': 95398,
    'fq3MsckD9KDcNBwCWbX5MqfQE0YKkEGOfx4LVHLhDBE=': 83405,
    'S7az0Y0to3k6ffLW4SXBsG5eUm+1d8e8SAqAKik8V2w=': 22854,
    '1QGn3HAth6WV7GNbpPFIzhHYuQoLOAaQ56ECsRBmAyo=': 23523,
    'X+f9jjwM02fAoLoddkZVumYTkT0DS3YjIkzrpmE2nRo=': 214605,
    'qf8ozNOfcHtaSf9WsUKsPNMn6EqbldGyx+QzSQlB7IU=': 14000,
    'h8z6wxrj6ReIAx+oe+P3vhGB6rqUN6nISHPoUbbLPNw=': 4955,
    'xEXqGxaNqchEB0C/+VGP/YXJbwD2H7qo1r40bHTFW7I=': 229248,
    'tvy1X6LhqmZFfqZl51SxSqK5ok7GnFLI2QYvrf17zVM=': 14895,
    '2NDAOkxc2nsx6Z5QTSjj3h643tBX49TPPVaPQ1VDrUU=': 94712,
    'q9+c0BT+uhey4BQJqmL7qUdXC4tun2XHcnB46Fid4Zo=': 2056,
    'DDUJItgQaKo4mhRLliJD8qXSmGhhjv+U6xyjt5YxLc8=': 162477,
    '32kqO4dS0p0M0P7cwfSVpVs3EkLaE8LDZVgVedTRhck=': 30927,
    '9s5rPewGLn7WfYF1Yhk4F3/hqklxCh4doomRJZ7K+EA=': 20082,
    '2N35AYu1Nbko3Ztyxw7mUhnyk4JSDD8nQU0uTwv633c=': 97472,
    'FO11OjT8BGQPkb8/cKdppnkxGpq4DqDSPGYXC8u/v+c=': 49869,
    'GHw0AKWOoew4ifqbcOsB8AANaA4jRVxqV73aE6MY+QI=': 76166,
    'KV2rL5vmUA4J3zlGVw+ku/yvMnQgcCAzvai+Yv4jAcg=': 39975,
    '5OwuBJwvl/PwSHp5Yye4zoDi4MEE7elXmSVKNceXR8c=': 34766,
    '59sMyOCAL+8kRxNipNWFLPbM9ysMHG6zLCD5/HsGqwQ=': 3824,
    'Zj8sLUDTYzGUICoyNXY8TnY5rC/uLlSLdw4kZZ7w6uo=': 31452,
    'UNT1UbtZmSn4pv7Z64X3t49Ic/hMPVOHT1/8Kf9rA/s=': 45686,
    '4gvaupcdO2GHI9ApT9alHXI5nc6OdVWeY82ixD4bMJY=': 31667,
    'XL782wDPeNKWTAG0tHYtZXFC3Q6PIkpYmlWQ3V7OfIk=': 556,
    'jdzc74w8ziiFAypaFivrKeQmcmLxy1wK2SEI2r3E0xU=': 7526,
    'jfywFz1bTWcArrwCVMwJ+Ohz8T35QyKZArpXRPYhXBM=': 11352,
    'lnPRdE0t5+UcxPWByyb+VBUfsgB6IaE/N9wF4weMMeo=': 56116,
    '/CP2aefKs81s3ATpF14nXOy2bUcrgi9dCGy5gYuJtwI=': 4996,
    'Wf6fm14Z+D2mMBjNc1IderErvQc+C7nHnTDsxpei54A=': 102321,
    '0/e9TezLZ9l/MkAKUR3WdQ4MM1z0XMaFro7Fjgh4QMc=': 14769,
    'ggUIzO1Ccnj/S3wlZ3FeFhig81jtcCn/B4ZSENaTQRU=': 18035,
    'lw6MoEKEihfLQQ/w/UAsoUCGsfQ6ffzYj6f0EpkUxAo=': 65458,
    'aNeDW9ehNhOYrkh/h8/8qob9B8dYXmzsQmwvXyvUQ6w=': 154273,
    'TAwVbTS+fXhp0GsVWM9aBe85bQoSJiW1PXvZKarHLlI=': 69175,
    'XIMWMBQZ83Y3ejmEsCg4i9EWtg8aoeqidN0NPlqQMU8=': 65193,
    'aUZablaFT8KwAGAHPo+ddV3cGEvru4X2Y2oD6cHCmYc=': 102496,
    'AmW0065EusyXOwKCs07+kAXJ91Nyc2fgIsTIn77uWlU=': 67215,
    '2oYLmE9MnNgBnguPEmfU0CwC29LJ77xUrJRv8LS+cjE=': 104848,
    'XN35N/KWmypTyCPUFnPYp/0TE/HeC2Y5Kn05yKvZlvw=': 60908,
    'wQa71uLGEaWRt/7NDwWI6oX349YAo+6NxyWfC70yvXI=': 68174,
    '/tzlUXolPUNFCwb467VIMNRSGiSVDqlTSoZDoQJXN7g=': 61094,
    'V1gt56cRCOOSnh1KVvaXOFu94N4JVeYMkcNaHvDIIMY=': 20586,
    'IdYOrXuIkFroZ5FyNCapV6IEcfaiX24LDK7/fLAyvRA=': 33831,
    'bckYOrNpQDbWOP7eZ/v7R/0v18+AiRE+LAhMlsvUj+4=': 97857,
    'xgAfn+eI9sMHnwwV531UelHprvB9kiRtyFatxkb5T4U=': 49318,
    'iDhiuuBDJnsCpZb4ZdiBT7TOGAfAsjtfhjH5L+7D1eg=': 41687,
    'wbCotRFFMmVt/bFpiZBUn8CFEcs0khGdwCbzTN0YDcs=': 32529,
    'immfOEIxIar3uyN6bO5Q2uHBuN9ZHgfn/Ww/BCoysQs=': 62284,
    'sT5EpHQlVwZ3jtMYiU2CmF08ppBHgJWATZ6AsEMPx+Y=': 201283,
    'xPGuHHcU9kUkUa/BTdC/VYB9DDBKzATu06vzPHA7Y7o=': 47994,
    'mYZL9TQfqxOHt/l10qCpe3Hk1RhaCPxTGpRF/q9L67E=': 136586,
    'tPEMHY3BydGDDokcumuJCOBwevyjESUL0bRgURgPkqY=': 11971,
    'u2/RUqMM9AxONTTR4h1ijzsbmgnG6wQA4U8vzbWiTTs=': 50157,
    'EaeB/PorHb59C6XJP2L5+5KgxiW+7bqERjQpv/rKiuU=': 21810,
    'n8xVJFLg/oxFRbJktUKIdnowW7QS9787hOIibaHGilo=': 52789,
    'LVdeseYYIah5qDSwf4DwoEa5GHjqWEJ1gH+1U2xyVJ8=': 79677,
    'alkuFbqcQlPSG5CgYrPVQF0d0rB4DEdo+AygCEVt1vY=': 20206,
    'vv7+g0HZGrFj/K4OzyHXWvnaRj2uLKG5D14UpqrIB54=': 14207,
    'aPyULfZS0u9YmxDg4U2ztukEMSI4SSLbP0rHFjSKpG4=': 4640
};
Class.register(TestBlockchain);
