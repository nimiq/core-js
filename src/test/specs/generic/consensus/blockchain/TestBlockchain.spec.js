class TestBlockchain extends FullChain {
    static get MAX_NUM_TRANSACTIONS() {
        return Math.floor(              // round off
            (Policy.BLOCK_SIZE_MAX -    // block size limit
            150 -                       // header size
            20) /                       // miner address size
            165);                       // transaction size

    }

    constructor(store, accounts, users) {
        // XXX Set a large timeout when mining on demand.
        if (TestBlockchain.MINE_ON_DEMAND && jasmine && jasmine.DEFAULT_TIMEOUT_INTERVAL) {
            jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;
        }

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
                if (!(await block.header.verifyProofOfWork())) {
                    throw new Error(`Invalid nonce specified for block ${hash}: ${block.header.nonce}`);
                }
            } else if (TestBlockchain.MINE_ON_DEMAND) {
                console.log(`No nonce available for block ${hash.toHex()}, will start mining at height ${block.height} following ${block.prevHash.toHex()}.`);
                await TestBlockchain.mineBlock(block);
                TestBlockchain.NONCES[hash.toBase64()] = block.header.nonce;
            } else {
                throw new Error(`No nonce available for block ${hash}: ${block}`);
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
TestBlockchain.NONCES = { // generated using mineBlocksJSON in the console
    'manpsfMK2+EQq2s3sdH3oKzcAoN3XW8NBKTekHxA2oc=': 33174,
    'kZDiSDJ/C6t0yPPuFJqExPiHwnRX0SM7cHofDkjO8Yw=': 45648,
    'lF7DH9YlSJGYcI9JyJ/u5rlL1Z0HyATApJcHuA4Or1M=': 76252,
    '609OC/Au0lQrgsv7G41egdmaZ55SNoWaZC8wkWwPzrQ=': 29002,
    '//ki5goR5vHt+oV3FCEzJGVYObaifXKodF2tQAAZt9w=': 44359,
    'UJ2sqa+QF7fb6tAgIlh623BLMoc7M2mcJUus8MmuRsQ=': 33864,
    'wY/UBu4RIAHvcxz6tupgqeST3RkmVsuxuBCHCTQ7uPo=': 24741,
    'SSgD9fklIabpI+MqNYzk7ct5aetbXmw1yHbyfUqif1M=': 79928,
    '4+j8iMfnKTcZAuZz9D+icSp29f63hWc4wFWLUhUAr8k=': 14611,
    'aVrr36CJ03/XkCCLJFOdU7IoFx/UH/Vgakwfl3kyjNA=': 89191,
    'EMoEJ6ket9JvJ7rdA3dENXxiPCFAcJaO7csqYufhbIE=': 6803,
    'USiHxXYnJ3tRSKSjzL4jaTAbj0hasjJZzZ6lirOAw1g=': 10417,
    'qWAHSew9bErz/0KxBXKug3DNDe6aaRhMY7BzSCMbQLU=': 12589,
    'hjhvxc8KDdFI4HbBzRZoPNdRYpKA8ov8i0COya9dAzM=': 20295,
    'gD4jTrWT2U+bUBg73xoubEH/120TbaBpI9ZjRnMUf+s=': 48121,
    'ewltYdWK+9yyLcmcp2ktqIrzxKygnja1mP2pDfWrl/8=': 34874,
    'fECZSK8yKtjQTNis4T2VZe3IebznSPrtSinhfdPf8K0=': 54828,
    'P6hOaVXL805gFCE++8KnfyexQvdug1jrz/5WW0MXNMg=': 80534,
    '4o9hzQ8fbFtCNSUizcMD9kYrN/60TpqsR7tiVFJ6luA=': 1618,
    'E3PmlrH5/5OthEEVEYmF9sIKVsw9QAV1J45CXsgKptA=': 49,
    '5mkK8Mftvxifyrhy5hZsfMSrAE1emDlwLU5EIkNBZRk=': 315738,
    'QDx//342bvEZ07D6xtUKZbD/m9RtncQyC+wkKtRTNBQ=': 169521,
    'kCKpd//GkQqnvSfNenCHG8lwGTXnIQv10l4NIFB3AdY=': 26683,
    '+lo0cFgz14erAdzOeWmoqJekA1GaJxM5Qjlw7yP4SoY=': 80040,
    'GddCqTh3ObiUv9HiIBJ83iXIO/DqES3jYvYvQ6gzh+A=': 1499,
    'Fd8UGEWCb1Jrp2JrXLspY9HWjcWTyW/ScXkmTJwz4DU=': 15720,
    '+qsNU8tXvZSses33FB/droTdxziR2FRtQTdgT1KWkIw=': 36262,
    'uusz3++nXzDVMBaSMNEsx5L+tCsLUHINBvRnSU+8Rkg=': 129302,
    'HE9eNMYM60V0rgCiz2MpUZgK50BqpdRLDd9vMg9DT2o=': 3308,
    'HH4vP4B4eJEKJkCfQNE2m9nWn2iWNlDFEwKifwUs+Uk=': 14974,
    'trBv1hRLXgVEEx5rZ+NfDUbGlwhHW86D8QF7UZ6ZjUA=': 98187,
    'Qbi09oCgJxNJrK/32YZ2XKiJJdE7/I410HI8wJ15d3M=': 136642,
    'LKvsVJ7sSZaqKjgMvU48/kuLuJsNj3ZFB5hVja4dEWw=': 61080,
    'QDA+jpR0kSJwmvhY4JYasZu9Bskfz11MGic5BZ3C/lo=': 225365,
    'iqiKUL1UBf5ecyFz5QplEF5BjcugWWWKTZ9dBBEiJ1g=': 10061,
    'NvfXc1OlRHaJq5+tg/0A5GhPxuFMgitM1rY4H6KxySA=': 27803,
    'nxE8rbhnfyKU9a1YzEPLDpcDhHUD22UzN9GuNxSR8BM=': 43169,
    'BNMsH91ArVyXkka6IqJn63EXjYoaVAd4Y8S9RvgJJ9M=': 81623,
    'tXp5flavVK5y5IOFAF3hU7+eGNewGrMOFT2BhspJqbc=': 19899,
    'FfdE3MZDM1pSi2CAPljN8J6WLb0AXxuvq1BJBW5p3q4=': 164641,
    'FDzZWouWC1ItcfcW/AaEeAq8Kr8JNhjQ1KirLw82GaI=': 77557,
    'db9eOi/0L0snmec4gPBUOfnR8H/yQd4XNgDGZ5iF3wo=': 20192,
    'bZgnTUh8RhUd+dQxkvQhqh49RFgTcUCYP5XzuKGfGlw=': 49387,
    'Y2ZHB80FL33IX8HcMVZmw+Ealg4UJAorcFMrFsh/Fc4=': 110424,
    'osbhkjjXkm+8Nz/f6Gv+5J7qzRoNDENuQEEYf4U7M58=': 206506,
    'E4c+z78HTwPZIRWFWWuRB3ZkvPtRujT25L6YF8tkIIQ=': 10615,
    'Y3cGcSs/PG5EhJPs5edAkAzoiaQmV6DxzWknxV4GOXc=': 47891,
    'v2ENbJlMYRk8JyT2ZhMHX95fuHDp64lOCil4LxS5MrQ=': 14496,
    '7yDK53vzA0Qq6Qtqes6y7xqBQrf1AFj2lueXlAoxgu0=': 28898,
    '9okMElhp7tpLS1+daTPyTwrFHGhddIhWamW0qVS1npQ=': 71213,
    'Qulsvn7K+1Isx1yCJgr01LvB2PMOBIGzfiaCMlkkRCM=': 23295,
    'dL/hgZBZfMgSpP24kH/Vcdr5w+QM7UrlsrJo8PkEZAo=': 12015,
    'KEX4cpZbS8Pk9dPaVrYuui6O+XieOCZUi1x2dVYQwog=': 107041,
    'n88Ly9gR7NefIZ0pRzU76WdQ84e/oII8AccWFM2BRBM=': 135529,
    '1z9KB7Nh2Cwqq34eEU3nx3Pk/s3Znjxnuo5KHnHV6hc=': 42797,
    'lr1hvxDM28bKvB/fjn1s0BjeiPRzhAYqW2OJfiTTG8M=': 119019,
    'l6oUeHQoC8S9ai4ak1MZWl3YF9LLvj6dD7685VoHM70=': 42543,
    'Ab5XbE/qIpeJ5JZqYNGfoMUruWxlUHf15EAIdgj9Z/Q=': 911,
    'L8kSEOD2rI7YFOLy+7/NcThy+Atno3IH+Gn9MdusuwE=': 23222,
    'EVTH6Dj7fDCyIErGaqYnnKODveEHv03KxAR/bwbCrKo=': 138433,
    'xIW5Q8OKa4eYEpNPwxPM/UVJubrVRKB4u9F+RmNkuJs=': 61000,
    'RWOjUD8yakfpikj0FIvAyDuXc7I8fZbFSpB8q4CMmz0=': 32563,
    'Ky0OrCsZx/3et7BuPUd0qcf+Oskk6l/OiybgUhoK8UA=': 66313,
    'dPAYTgBh2Eg6vyP7nEZVTQzVJoTaUcAwJHY6MpcUUGk=': 46939,
    'YZ/V+MvDnjUjHZbj2chY/porm2l1yJk7OF1d9qvuvgA=': 1008,
    'mGVOQAEJTUhOGB3Y8M924hafwkaYCRyDmRcl8D89mo8=': 47335,
    'PX8Csuba3afpBMC5tz8xmpdnijLT5RjNYJWHUpAW1kg=': 25139,
    'FXeZ2NYyXaEeU0UHex9caBMueqTOCkh87/seOu8z0jE=': 58735,
    'dSdpmqkLoKTizL+/amUwXBvT5NIrwjqCfsynU9IQido=': 22600,
    'AUJ911cjbDrZmYf8xDSspSshAgsbZfw4eQ4o0sPLgR8=': 78141,
    'ggUHEZ1Yyk24THhphB7+Zb4gGGZOnBQaMh/Ynr5uX5s=': 22824,
    'vsGnVkg534GnBm65MY2gzLTSAJ56ac6cezxAihNp+sY=': 78866,
    'uE6/nodNaZ9pCwhrsojuelI0rxYWhvwSsKQTX3MheOY=': 14902,
    'Y3XLlijLTEO6oK0xdAFRJ9nfDOHhk/NlXbvgRzRzeUs=': 59319,
    'X43GPJFARBgysncWhyELWpk+HMJ5l63UzFUpDQdIEyk=': 229534,
    'RJcv6bePH+bgsLn0efITBNvIQ8ZvEMwthWH9z8u3Vs4=': 73846,
    'MALQQkEIegD/VG8j9Wug6H/o1MRvWtZWSk5cnmvp9xs=': 108180,
    'FvkAJnX47IhjOHC09ZlQC7jlIUF1cBphjE3thzEEPqc=': 14642,
    'P/lr4OMJ21JobQLx2/UV4jLohCN8ozbPAjY+q58yXNY=': 25795,
    't4fo0kN+GKugoz6utdlRxKF4c7yFg8dxGXM8jbrPPkU=': 47612,
    'PwgN5G0EHK9MKLQTm1nE1oPjo/XFC3L9xaYVfFZSV1M=': 26323,
    'PmbSDtlaFkTih1YGHq7z55KYVlB4Cy0Zq10Pu/hfqE4=': 54046,
    'hJMeB7e1Qth6KwPFKnEfQneMooecsFxrmMU0phztlrI=': 37186,
    'PehnWto8jPUvDZJzEbZFvIdVROnI/Nf+AvDwya8k7jQ=': 179129,
    'YeBdzoIQcWx/jBl6jg7rj9Z051Q5GlEAmsyDzyC1GHo=': 33467,
    '+x6de8r2yLk0fHqm0HAZt4w3I5IuASdBL0eKD1mNXaw=': 63954,
    'agMm8BnOIIV3cNZi52VHklPk74WHw8fMeFZYPnwot1g=': 13796,
    '6XBZTBljMO2UNXLBQfnMKcyFgIUa0jRmAt5UTG0h3+o=': 25362,
    'dxHtuuOAO2HG58laROReTwGAEyCfBptRe2tHTMpG5Uk=': 4659,
    'VBDJdp/UqICNQIrvXZQhP0oMKt1HPURlR3jWxKJFs+s=': 31617,
    'ANx/1LyhGPHbqmGz+wWDp31xD2tmgZDipaWOeAbSNGg=': 89545,
    'Qf4fErAvUJcuwhgXR6HCGTS/oGaq2dLN1ShF2ZEQP6g=': 93374,
    'PfIl8bCtjQdmD6WFnb8ZZgfBb4r5AHu4GD2S6+WsGQ0=': 48642,
    'CKZrJlOwiGD0YJJOLHkLeHfq7RxBNoGn9u1EGdJFrds=': 22952,
    'C8kx1aNgbR42kj/7t2dUOqFpFCuJQPmbt8Ga8SQD0/4=': 5643,
    'uue8GvcW5mlRYPQLaDpo2tkriFSMLSLNYfiFnT0z6I8=': 31357,
    '3yCBPj28gFwkyYtIgXqsLh1+IOHyyLJoeE6pcKREj2I=': 31085,
    'c09/UZpkqJ8VUWHhpW5B09DNSrutbXYw+c8gXSC9a5w=': 765,
    'xpBXu4fXp/LNpjwoM4lDg/DsZQGFSEsb3CQngm18v7E=': 132819,
    '2ttOQ6/qm35T2ceVgtr74pJBUTMGfVjb9mAqPGpv8Fc=': 8916,
    'kb7RQnXbdiHSEnNnv/1ayg3JjYAUi6Y04M1EQdA7Gs4=': 39122,
    'Q3ftqpRDGTDbljIUpIJQ7bTuV+F81z19YjyzYTKaqDc=': 31582,
    'K/up+ihYeDTLjF985oLrrR0i67iGkbhAdoHQAFSIElM=': 88625,
    '0Uwx99DAacLyM349wTCSTH6lJ/za7iKkp/llsXtIvC4=': 64680,
    'XlOwexqpAGebXa06CTxLHXlkIvnOSHhrRX9ltZmIGbA=': 44623,
    'Z+DeCyxH0MPWjD/AKY3MWEpnRSGCCUn4kcBJWJ+err0=': 24609,
    'DxdOA6eQuYQJROxuYKjhqEMm/tn3ZltH4chdeAtyODw=': 182978,
    'Hzv3R3a+bgVkt+zOQiMw/A4PBO5XwxdkrZvIK+056Vg=': 25794,
    '+tZ9wkAT1by92uOfSyPPLcWUne85mfDNrJfaJcMXDhk=': 160096,
    '3xzvqjig+EXxJGrrqjdnG8lOp/Dj3Xdz/GhyKCv+3Gg=': 21576,
    'ECCTwXVZkvOn0C0ewMPNzLtNAvgq3bbzyQUbS3KDP0Q=': 23260,
    'EO7qiv7jxdOqz+BaMuYF0OPZDKamJ3rky5+Wm2iBvOc=': 10133,
    'APofHpYu7P+XeDpsxcFE0mIYwxpBjEehMWqgps1WNEs=': 48593,
    'BKWs6MX+RlO5jIiT39UT/L3qIVmAC8KZSIEKkQV4Y6A=': 110091,
    'fxg2gi4dtxRfNkPON3h1n5ln8W9tS8zTP+/RMHJMlJc=': 36608,
    '6EOhefaQcrvDqi7FGHm1jyY9OHGRSndMfi1d27YGdTo=': 25727,
    '39kye6FU8QNnsj+xl6AEq4VbIuYSNucbk8NkKYU6RG8=': 61045,
    'iJ9ZBUuNAncwbJqMDr1cccQND5BKykblY+YsDCjgdZQ=': 67680,
    '725ZqrPo+Gf9p0DWP/kQdvZRJT+5etMfgUkfBP0YU5E=': 180548,
    '+jJ7JJMuAm3oFOiCm8jkh4ZyIF5YYDU8oFtAZmskv6k=': 21015,
    'Hbn/onbHycbjHNLsiQTclfygBDfQTdUrJyAqUneXjkM=': 179665,
    'NH+Eyvu7Z4iAk593SZyJnfWLZqWlEOoWYOb6+qKR0Ss=': 180618,
    'GgbjskcknbRNGFxwPDUHyNjraGJFuimF9pj91Gn720Q=': 114113,
    'BqvsnGXAewA4hvjrXAF9CiQJxE4gavFa7t6/u2CEjlk=': 15382,
    'M3uNWzmiKAhYmuattlDeTvTd3OREEn5edj85aqd1deY=': 61246,
    '4JcpD3fJmsLX0r1UYjkKszFiTbWtDSCWO/m7gzjJX1s=': 31100,
    'jQCj52XT0JcKqkiWmRp+C5gqN+EyyC4DB33K66OqD9w=': 129677,
    '8oK6CxPd+waD6wNPpSNG+Wx7pKRf7lRZlj6M9+Je9Og=': 70441,
    'fxnuQDkVpT+ToEcvWU5uih3JqFRsGHXwVNBwPN21GRo=': 66160,
    'XuhC3QPS9COthppUMjfmxKsNYNz23O1107z+bZc4hQ0=': 133711,
    'byPsCUCCO40ZK0viClior1IHEmaCtgke5yGLoiaFGnI=': 37830,
    'T/zUWRfB5Sxxki6UMoT4XmYz+K1zmuz268BnzWxaS00=': 651,
    'PL97lj699nThk9M3Nq7+N4pr+5yHuj1FMU1oE0xLbmU=': 30991,
    'ypVLXu/557nSCcm5GJiJMZgMK66fk6aBGiVxMwTQ+xM=': 37833,
    'pUGKIiNKQi/Tw6MtWZafQwdsUUZRLxkLhNZ3i+MWLwc=': 28639,
    'Nq2jiEGzx+rUMshO7y3LjnpvbL0bURA8++HE1RXBFZM=': 5489,
    'eDfYMoplK0yasHXvkUqE5zGC+M5WEV4UjUe2fM7AzDs=': 44582,
    '84zU01U1m5iPB8Mpsffmh5VGL/KebyJQpsjBloWJFSM=': 28618,
    'o0vakSuJ4oEuLxQm9wOU+zCdUC2qoUtUfYUFtAMqYbI=': 19783,
    'GdXkSZp1khBAa/QsaYyv8BPm5kP4K9FOmkb++lLIRqI=': 77503,
    'NXVy+o98fVXdaomCrbN4XBiDeK+mQyksS9HK5MMTuMM=': 217523,
    'CkON42CSCi5JO8lUDifyRP83G6Dc5QwYF9vubpguoSg=': 73028,
    'vjuol47Eehnw+3EbT8YjnqlUU9zLHaMQxw0jufqFVAE=': 72047,
    'wd3OPvVFfTtdvxTvipVeiKoP/a04+zJ4YTuYcRRPCT8=': 32255,
    'QS6pstwg2sx0K+JSY94samDwSKR4ux3xZIW/kTkhlDI=': 44354,
    'ZyHDs+mWHARcZx3VOJbcRgEuNwP7cgBRH2g137nuc+Q=': 73073,
    'iiDwUPFMYFa8cEp6/nQdh690gHw+Z51j2XzpjecUvGw=': 43865,
    'z++1gd02ALaRDRE28Q0714AbhOWyK6ab01ljO1qDyL8=': 37408,
    '+KjRobSzzjokZQiRLJ7r0dhfqN3Y6GNFy9mAmHq9p6I=': 76388,
    'dP7u98O0eIyC2clgULGuu5w6fvFe1tpl6GHBsCEINkI=': 100897,
    'mKiNrc/mb9GOduNnzATW0WludItXbuD4G9q98nnVAEM=': 32013,
    'g/k66ZRKW8O8Z6urVtZPYJCIZ20FmAKZoMu5g/32vws=': 46716,
    'L/qZkxArHMlbJWpQ0fELmHNK+1ikfdAQxT2EZ/7LBfQ=': 52122,
    'zOtuxw3ozKmJE5iF6984zXO1jrmBLMZkTkofQkdNqO0=': 171721,
    'PFJuXaD6A910pe/H4hXlHUc3ZKtIEhJ497RczIdV0jc=': 184457,
    'tA3uUk5IZIppu/bWofqgWTxetZaTkd1Z8LnWpTBqq/w=': 7412,
    'hC6irTmCLvr2lztWtA2RTH+1PX7UFAhBZ1MrJMOxjjo=': 38523,
    '0W/WgUj3fPWiyEzgD5+UDCKm+SWveD5bSp2OE45HrLI=': 17676,
    '3CEEKjuqVeEEweXIrZFc+RYOP2PAuyRTi6Qt62Ghy88=': 126892,
    'kPlBLzVTjBtCmgZN2Il5W6QsdTgOEn73YWbSHOTnLxw=': 126884,
    'jCtVZ72iwASDqEz2tOPaHkQ9oB9xY+6itp6XUSL5S0A=': 87404,
    'Rt5IdhvipgRp9mwIzlOEDyRD/Bp0dmR+nSLeQ0N1XdA=': 58043,
    '+bWmQfstdkBGYVGkxWX/tReh66hlLcW5oJCyi1hZyik=': 17273,
    'dWYr7zeHmjcGW9MOF8yJt1jxu4l38gNjataMwypZU1I=': 27499,
    'OVFLzgWPEQZMuRMuA2+R06LzfrlY6x+3TsnuXdvItys=': 208098,
    'nxW8LlT9c4dwfCUF6gla6JxN/PV4xooNIApJ6Q9hTWw=': 39999,
    'mkTYDO+2CIomGTW9cMoEecp1l4UHrnd6H/X9K8ymVJE=': 238146,
    'mw4DZDUwBM1H6GmdWnSH5K7pqmePsozR06VnOflJbZ4=': 1109,
    'NBgKYec2tpLqO60i9ikbPJA7aLpUijq1bVmhU5epMMw=': 47129,
    'sL2NGcmKjSsyqsYAviT9KFqvGxJVGtNa6km99WVJRrk=': 26570,
    'c4sfljdpRJSu7RyjiZowcTPA3JaNhehKdIZLX29IAqo=': 59940,
    'Xxa6OVY/f8VQIezHfr7PPtWDGuO4ZBE4H4HIGk/THo0=': 17451,
    '0xG1wLtwlpoShBtQHmRiK7LRx87VRprZU4LGNXkYcjw=': 38507,
    'aa2JHzUcv+/CVLp1A2wqtK1kNUl4yTTore8IMJ6NazQ=': 57916,
    'iljfwZeaGAAXF470fQ0mhF9Us63HcT9HEHpVsKyqkJc=': 35515,
    '9imCeLJq91E2y6YQ46d9LV57beAk1EK6F+cxNI1t6fU=': 81303,
    'rkgkHXqhYB01Zu5uKGX36/HIEjJgrp2HAHaszU0QYfo=': 140243,
    'n1d1e6ISJpHXzLECWRPe/OXvRTK3edKN//tYjRUlsZA=': 9702,
    'w7AsO1gfXc8M81JGbGhXSOlZN1b9uZ/njslLaYsRwoY=': 107703,
    'crIuEZK5vE4mUYRedPWKygFZeTwcE2b7WopB0JjDrpY=': 50208,
    'nd7HAKTRVCOjgpjwqsZZ8yaXotBAeeo29pUard8iJC4=': 163878,
    '84ka8/d95e0WLgUWH6VGlt8rsJfY/jZy4dS8GjrcdK4=': 153518,
    'k+QnjOlhjhy82DvqZdRMpq8PUwZ1ShiM8hxNd9ZO5E8=': 42488,
    'eJmdG9yC4k71pEoJoni+VpABLmLQT9QDnb23ge9mk1w=': 160885,
    'IkpQLxGmqfaU0lGtd1QYj2+DcxG/U/PuFKqtgo0qhdQ=': 31497,
    'XPX/5o5KKrK9IJnB3GR+8dO+pal5dBxkkHahSBU8iIE=': 32400,
    '3S4XZz6LLi+e7MM78oSePdolj2R8fLeTZyH7ZanvaPw=': 121172,
    '1UbVpTvEIiBpLe6pAnT9jyV1vGRSF1qv14akhCER/5g=': 59524,
    'YTeVR4HqieeNfDzXJjK+kWWOzh1MbUCaR7HNDATWnko=': 52956,
    'P4TUu1aoA6XxOUg1vmFYxQLuDSkTOUhoqvOjmDDX4OY=': 14337,
    'q1hZPcBp/V3gNkNmi6iFP56TegTHBoNFCz31rTZn7/k=': 196135,
    'N/MjFK5T1pbV7UWolzbXocaQW+f3BMxlKFjW/IBuX9c=': 93541,
    's0049ZqbyGZY4pWrtn6+Xx11qGH4WUxAT981RibgWF0=': 38338,
    'wtmIhxhvNtu78pEBHYvqw2TeQGkZ/40t7rW+vQJmobY=': 15216,
    'nlyIQ7VV7wxu6Iv2+32ywnkC8b03rpZwSXRyApf5YXw=': 59712,
    'ufCq2aMk++uqO8Hl03fZRKuZtnq2E7tDj35rIvAOpDU=': 19345,
    'bhnhHw3sZzjQiFyckTs2tLqNueKJVeBE4y5gUk5UoKE=': 80167,
    'UrP4ia6SiE4MbQ569dKHxKqI2o+iKoBI0gNP/yKPP1Q=': 47479,
    'zBybhlWDzup0S/hQhZWhQm9A1XuDwBpqURhJwyif7pE=': 50358,
    'ijK6Exait0f4mi97ExQT6GoFkIPn9ZboA4jW5yn/qCc=': 205502,
    '8O2lRJlo5NM2iMHXAFIMjURzMPk1tTcFL8iQoZL043I=': 107969,
    'FfcnYeLO3jFO6EdWm4N9lr+s5za2nyJ2N/jMgDyTAxk=': 191903,
    'FiHad1y7Ue/hI7CkHZJa0NF3scmJL54uwHcm2bY7pDQ=': 22563,
    'UI1CnSgIZOQbIp09yyV061fiquHrSiwInmUjNbOnTKw=': 18992,
    'Ei3zjwkSkJ5tUn7uUVi//98YgVHoEhWTHZLF7y8+HwI=': 132786,
    '4bj35AFw34iUiNJcyBKaur9XoHwe4CoYMEnFkZOGmXw=': 161700,
    'sWz3QeMmVVi0tGKjSTzcjzRQtVWjsmxTsl7T3PEHuwY=': 35913,
    'Qbio/1roLtJDIMkLIopF2FyFHxmv0n73pPXlENs3QpA=': 55997,
    'EeGGzzxMPRrfJ/AZT8MHidVMO53YbLHIsM3RAeDEE7s=': 2429,
    '27eYUesrUZBTeqQ6Fm7t8bPWWPgjwnExMMew0g9a3VQ=': 191015,
    'XCHFvN2gaH3a2h8QpgoJqi0Xtk2D0DZAkzrV1txBmDQ=': 8679,
    'Fw7kY33dDmG4SdBiIPmAQbUuogOUZFZ1wwmbCoNM+GI=': 54808,
    'N7wSWZ5VFoF5AMRvcCbf+6qusYODHvPhXGtmvXsZxFo=': 22189,
    'qWLqoxUOLHq3ZviMCp6Wj4HmK44Bu0jvrTuP523BZJ4=': 112935,
    'TMsIYi/nrh5qysrYsciglpRSF2Y3dCCxQVHJGZrtnZ4=': 72337,
    '3fLJ32xcQrXVU//hpmbcPQWKaF/Rhfi5scuaykh3TnQ=': 24015,
    'O7A1x/3bfTZMdCEIKN0VTre8G3LG3GIlKLqP1J+08KE=': 28279,
    'pewaLYpd8y0mSMhjZ/J9lyYMFgENVV94N5Ub3WY/NQg=': 159523,
    'VuL6qtAf5lSQOu0Uxy0YuCT+1mveGyjQRMX4aOxrN+0=': 3656,
    'd8m3ajS4bANx6SZjqyPDopULcQNQBlLgLZcBTzRceOA=': 18582,
    '/nw7/WnIXjEIX63yevwq+vtf30E2E/hPV7Mew7RQWxA=': 116111,
    'aq0CXOjPl7HUV2D6YTrKMK3W4Dv6n2COprurnlqj9VY=': 56525,
    'PwRiIgf/w9LolYb38cTeAfXsiZzv0Oi+havGIjiOpwY=': 76493,
    'kgJi5DerP+ihmVTfzC8IkdK3kcFJYOz3T3he0VtYTjU=': 71504,
    'jJYsCPVxBRIuDmULjT7tVYdUSm5LK7fszKxaCmchcCg=': 73755,
    '+l2lAT1PYMgHJP+VVvWFjHflpnPK62iep7mI/AbkQwQ=': 267760,
    'y89dYdAzKOhlUzZSGhmDCVifN7eb5BJ0eaxFzwQ9n1M=': 138861
};

Class.register(TestBlockchain);
