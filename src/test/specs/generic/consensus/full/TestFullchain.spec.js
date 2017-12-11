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

    /** @type {Accounts} */
    get accounts() {
        return this._accounts;
    }

    /** @type {Array.<{address: Address, publicKey: PublicKey, privateKey: PrivateKey}>} */
    get users() {
        return this._users;
    }

    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipientAddr
     * @param {number} amount
     * @param {number} fee
     * @param {number} nonce
     * @param {PrivateKey} [senderPrivKey]
     * @param {Signature} [signature]
     * @return {Promise.<BasicTransaction>}
     */
    static async createTransaction(senderPubKey, recipientAddr, amount = 1, fee = 1, nonce = 0, senderPrivKey = undefined, signature = undefined) {
        const transaction = new BasicTransaction(senderPubKey, recipientAddr, amount, fee, nonce);

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

    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipientAddr
     * @param {number} amount
     * @param {number} fee
     * @param {number} nonce
     * @param {PrivateKey} [senderPrivKey]
     * @param {Signature} [signature]
     * @return {Promise.<LegacyTransaction>}
     * @deprecated
     */
    static async createLegacyTransaction(senderPubKey, recipientAddr, amount = 1, fee = 1, nonce = 0, senderPrivKey = undefined, signature = undefined) {
        const transaction = new LegacyTransaction(senderPubKey, recipientAddr, amount, fee, nonce);

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
            const account = await this.accounts.get(sender.address, Account.Type.BASIC);
            const amount = Math.floor(account.balance / 10) || 1;
            const fee = Math.floor(amount / 2);
            const nonce = account.nonce + (nonces[j % numUsers] ? nonces[j % numUsers] : 0);

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
                await accountsTx.commitBlockBody(body, height);
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

    /**
     * @param {number} numBlocks
     * @param {number} [numUsers]
     * @param {boolean} [ignorePoW]
     * @return {Promise.<TestBlockchain>}
     */
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
        const share = await new Promise((resolve, error) => {
            const temp = function (share) {
                if (share.block.header.equals(block.header)) {
                    TestBlockchain._miningPool.off('share', temp.id);
                    resolve(share);
                }
            };
            temp.id = TestBlockchain._miningPool.on('share', temp);
            TestBlockchain._miningPool.startMiningOnBlock(block).catch(error);
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
    'OVDa16JupHwUEA981c5w+umjc+lYyfIkzhPCUI/MqAo=': 13329,
    '6i053oKunpjLdXTpgJvAzRSGWKiXpPJzKT/506AxoIE=': 11819,
    'V0PF16MSadREG4sGynZaeXxpo1YigqnPI2maSM6GQb4=': 96879,
    'jPOG0yLAK78CSQoLAPYnnvUmCoVSZNuHUUiuHMbPU+4=': 159195,
    'oL4MEcATWwMxkpLkMeuG1ZuahInYXJGxlO9/V9YFNDI=': 18694,
    'Eez1G0uxuAOOyS75uwxZTBh5gIwtEuYJTjk8tHBcuBI=': 162490,
    '7cyIBzjnarUx43jauyq6VpKa8pW4+2GLT3myAOq5y3o=': 93094,
    'MYUAcIJddBjfWvPf6T2leb4/PUTNqij9zyigQXKcUJU=': 9820,
    'GzcIZWtqLeFAqGvHAOIam+q/jaUAi6VDoDriijEUVDY=': 44323,
    'q/1udzKXMSa+ZwVASe8JKYmC+snOw7wNMLTvXkxPeTI=': 27217,
    '1Op8tkhEvFfpeTSU+OlbC/yQcQoj/P/J14Vnf5ISlEk=': 82206,
    'ZGbhjNLFOGJ/2g0lWuu2aXEGN9jThhvlo5D4HQJpSDM=': 31644,
    'UEunE8c1SaWII+rZ87xiHPQag0L84BUuuOLRNxbaRBs=': 17286,
    'UL9z3FWOHumYzHagqP/MrK8f0u8ElVUpmp6/zW0Ahmg=': 66867,
    '5baROfsuqdmz/EbSIf+nVQqlnb/6mlrC8ugIWlfzlcQ=': 351984,
    'ZjXJL9cF3WO7udvI4dtayTSnKFeLr8JbmRotEs/L19o=': 46839,
    'WnEcPMssco6gzJSWWnwUALBOb76DiuIetGOqhfl81Bc=': 6542,
    'YegIZOkc62r6z1U++fKYWMcDQD+jJariRCBHnN7AJf0=': 143846,
    'M7ZZ6cEgFB6NUJ3+A63ezIM5BHn+3+0pFlkIvobZo3o=': 65342,
    '8Obrf2EyCuoUYuhrQ2EJ91hn84qKaATYuL4Yl0kilg4=': 117977,
    'OcRe7QysJ5heUpWygj7nPU9Nqj8KbCUHYJP6fSYM750=': 57982,
    '7aMto/A1qUlgKeh7U5SIFZ4b3ANIFC0yDKNdo1bkPQ4=': 30863,
    'BMGRbmQhyF8oAqzayN8JgfurLhiaDLp7NCq/hcaPnFU=': 55192,
    'RbaqIt390ZfIDNjEWlMlBvb4oMrzw9CgFMD+CC6+G5Y=': 31688,
    'mW3muM0bXUN2n7SzMaKnk6XkIjYg0MsD3XxLmIKrAiA=': 5569,
    '1ENcO9PnAUuYHdcJvPUsYlu34Cua5pvp+WTHh6U3Pv0=': 8150,
    'MlDhWy8+rxPRj/oEJ9meVQaH+4EH6wZfoA2WCU34w1o=': 123455,
    'iDZqJbGUdA6S4DMR6csY0WgC9QGZIvkMZonkEtKBb4U=': 5548,
    '7y0M7z2fbJncmsY/x9kSA13NeDS03VZ+ul/kamMSK1s=': 63638,
    '0FDtuf8pp6l0QOc7Qnpuo80+o1IUnBmZpbvBoy7cQf0=': 108689,
    '42JJCq1FZZ8wVUPOcpTXMLdcau4uQYWecriwNgkVIqs=': 3691,
    'fAngN0kHRfsA7liiq54DD8KoPiKm7xhAHtJCw6Dm3+4=': 26060,
    'fKYLQ7CAGyljJ2U3PM1RMXeokzkp8ZV1hsoAMo7vUMo=': 69799,
    'mUSNcDT28a1pRwLFPHr3wK030OiSBQWM/Ah91nVWKmY=': 56829,
    'XEa+FnQ1t+H7da82xy2ha34HLQlzFdFeGIDJ3IZm9es=': 90891,
    'KDPUK1tJXLdVh7+ikb9mONkGR7q81Wna+oruehF9af8=': 73085,
    'Ed1CroaAo8SK6oGS75vvdNJwLjwStxEDYtcNQfhduvA=': 131502,
    'MZ+YPLklY4XJGu3n9knW1wJKEXT3P4Zjccl6qG+snFc=': 14931,
    '7njCPOE1FwCmc1WOAMiayGwUWMdR+L1AytGPMR2qBnU=': 98875,
    'ODPRN4j1qNL0cegjAF1eUH7T90m4yWM3C9BsmuvSKVQ=': 23318,
    '/qP7TdXxaGGY8mXlOeod1JOkIEsmIkw+Emg3DdkimcI=': 138813,
    'Xxz8OHx23c867Uos6VYHb4NePsJv/gKe0clfzqSqeRY=': 138114,
    '89LYVWjLLqviRnwQUNiC4SnE8Nyx3W+e0aq0glH1sm0=': 75424,
    'eMYoQ6xdEbnyFrzMdNAKeSclhgsBNrEHIHXvzTZ9x9Q=': 74281,
    'CT7UiEPWS+8pw3Za8RGSXzbW2Ow8v+nQ4j/SR4b6S/0=': 20470,
    '53IJig8/RuML+i04MxkkRVqy290ZADELeiVdlwPagyU=': 6884,
    'TS0rntSfHc8dDS4fSAfUjVmwauBzlkkL03lwT2EuYXc=': 25649,
    '/1JJY5m80N1BtsjanTKmqePr7Lu+T+ujzynsc8MNc9E=': 78214,
    'bFsWovtd+6OA0PDnkzQ0MPllvcQ5wn3UTWgpdLa7//U=': 39303,
    'GxBrn8J/6iKbFI8nJ5JO/S/njPgJGcMrj80wmfdX2OQ=': 74253,
    '8EucCPE8ENIPYL9pMbGqF0Zukgq0zcFQgQ3zfp6DUf4=': 48757,
    'e3g9piFVaT0zA2UoVnFdP1csCfM1Ro2/kH5WrUTXNbc=': 31275,
    'skUMmzUmMyxyo986Clo/VBF0nG656Hv89BXMuybQx+o=': 234684,
    'cjDNzX+n1WCvU/iOk+Ec8KCeyMUp7wkQg5p62YOItLE=': 19703,
    'VUpMLUsbQKexwe0yqeOVF4N30fYtzMaV8JORxj6HORw=': 108640,
    'cb0YhL4UQ/WthxA4t7m6ygU1KR6M5P0jwKcA4ANFtE4=': 37562,
    'EsqLjkMqPFhwVMiPmu85AQ9fi4TlFcPIDwvBQIPI1BI=': 6042,
    'XoSghLAP2AfR+70H/I6TT8G2yfXPFLwj/dyskN7iiWo=': 6733,
    'Wc4UrOlIEzVxkZ1r0dylqlhJtLhAfoatJbakNUy9kqk=': 79234,
    'TxQA4kc5FXz+wEjjnuQb/txX4mZaSmLkYTKsFW9SH+Y=': 24735,
    'Y/CbZfvAZxratbl9KH/30cuuDrheKPyLNloytUY9YdU=': 37201,
    '3nNmDBVFulAY57t50e+Lb4kE/bTC72jYNvA+WpIlYic=': 151719,
    'vQW2N11sXGtEDNQbxnxyl/QqealJW0hjKLvl0jWBuTg=': 133747,
    '+vocu4aFbRXzNVng7i+WBA6fDvPiSll5XfH2OP0V0ys=': 1048,
    'nIgCm3irXxPM7rz+Ub3oT7Uc5pfwY23Fy+/U+X06NjE=': 6378,
    'ED4HTV873AO1pGHTYwWQ7Zup9vXm0g2kjy9QuQCafR4=': 96867,
    'W6eqnRHYDCuPqZi/8XwwBNDKZHu9zVJzhEVBibM8Zbg=': 236243,
    'V6jJXAbW0UZHrxuVp9tkwgrBTUsbJIXzuL5iJU+qoK0=': 31949,
    '4QcKHHfGSWOHjqAN9XJ9E4IqusUxKKsuoZ2I8rj9d9c=': 82619,
    'G55I85qEAf62TYTvtdck/rMFbA2nW8MHlR1ZubOHnIU=': 32828,
    'F5/KFSbG4CSYEPI4Prsr91FK+O1iuf6HjAtVyaaDx1Q=': 31710,
    'CHrzZao33gzkrICKGvWqNXA8j6r0he+oOBFwfebwR5U=': 16721,
    'neA7zz7076ljmCpSwYFtdPGbXX4jHZjcxMyp7aP3sEE=': 45428,
    'HmXA39g0XM8nw//pecHcoVVQp4QqE2OJ2M5Q0O1qvQc=': 233820,
    'F66fJl5xg28jAxWTI4mK8vUsNVBAhPUIe6alyZICjI8=': 4598,
    'tEuGlPTz8pQrvLJo9wybIictm5VntXDVZbwJIgUjc7g=': 25340,
    'h4jGZM4Tq9Rb1hvBPLHDomJmryUn4TRSxNxQLAZv5rY=': 61800,
    'Wn7lHbzEQF0yw5JeKef2WVPtrhRZP/VQ3gXmM5n0Xgo=': 114681,
    'S9RsrTZqn0KtXo24mzENqP96m5bYyBhS4BQyt8PdBkQ=': 36229
};
Class.register(TestBlockchain);
