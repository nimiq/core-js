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
TestBlockchain.USERS = [
    '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'
];
TestBlockchain.NONCES = {
    '44I4exT873h78j7fPt9NsQ8zJDN9pXs5HQp7nsSSpOw=': 29803,
    'sGrcPmr93cOuUV9KTrVEjyxFgc+KTFzPM3I+9gnDM6w=': 45767,
    'zq4uNWiwIKVLiC5YP1bjXnm3/mNQ4QuM39tSvswKqoc=': 99981,
    'pHqO0jT112lbEdgoJbUPrHfwhrtgmEQmCdpjJl7mpyw=': 68267,
    '4oeIDEIi+kd6T6TgkOyXDy2FiUmIpiirp8yTNd34U1U=': 9528,
    'N8/28cYEygaHZ0R6hjGcvcuPMyyKOmXCZ9phhIZX/JI=': 60597,
    'Jt536Z5hsAGcX46pMf74rNEDONw9ql3L3CE2ejfIg0A=': 56417,
    '3/zM2AJUj6c5LZHUQPwwdlw32nRDdf9fW1h7Xkk83Ns=': 178065,
    'Z16Y/BSHK4efqhWKJdJ1/FVR7q/W3FU9mdn/2NkVARQ=': 56794,
    'jLCRBkKXrIKLYHF02IYNVvTpjjTBfZgrh6sHJtsF2jo=': 107971,
    'H+PQcJsPbWuDzOeRnHPLRofewA4rx0ZBZwWfFM93jsE=': 167,
    'HZI87FB6DDcFpd3KAygq7wao5k8Qis8kyouO8/LNKuY=': 25973,
    '8yNsd27riF63fw+HQoECdrNd7DMMf/6vpEwNOfMHQ5U=': 20024,
    'RttLOKOoyaEDOwamctd/rbmZTl/fRkRC3FKPq4UiIpM=': 178984,
    '0E4x3d9GQFAZnBiBdDX8e/NpxgICz7HEwv31StCSMXw=': 52289,
    'YSOfPf3ctZnPschCRirbAmg3w9BlPZYIU2RIKt+90Bk=': 2872,
    'ln7zkvYbu3M0/p0DSkMjBUxF+D8HVGsS7nl5QVHtkwE=': 16702,
    'hSK8QDRfplBqy8FxcVhFn3gqYJs3d114J2CNTQHVmZw=': 98037,
    'uN8Cc0Z3yDL6LpvtKrhVd/l89o55bbBIwpzNOhKOin4=': 22673,
    'UKgIQrAIavoLU5YAgjrEbzQ4aYk3eUFXZphDzRmQQ5w=': 108252,
    'U97VfWIsRna10qvpDTIqiA82P3JZ54/SUvhRD5lq/Iw=': 43109,
    'lPIayYdmFvV+JDdu3WLvZ5NVebm8x+WfSal/yT/wCt4=': 15649,
    'VxeJJjRCJCEA9rOfxkv3PMbZui7bDux1ryWzwuptkLI=': 17208,
    'HWzJrdUoPpcOppDVErVIwyFrhDHr2xCBFYEB4y0Ivq0=': 48867,
    'X/dEJbRArYjeslVM7g+Ohu5vZ8tcEpEOnqYoYvIwYKo=': 36625,
    'SqLwckw06RX1h3CxYC9cXhLA2H7RQa52lVo/hyvzcH4=': 104048,
    'TXQpDs0WOrhqcdUwUBE+WbNWjcfeI3VLjPNfIfeDcsI=': 21214,
    'nh0p6Fe0Tw9VpZPMi6UOQpFF3VIq6Gg6yPhfn6/05z0=': 69817,
    'Lqi3VUF89RVHKjpZ06xIN9Ez2GlRvMvAOn9EJxhH0+s=': 194376,
    'H28hvzmrMZpB8X0mXu+6dPWN95i1RRIFOB+iIOSOgyk=': 34720,
    '8sw3o8vg2/l46reoBPp27mrmW4qN7IOWKvcoIq+2O1A=': 47194,
    'NVdH+XqGo8Ym7Mt1h55DoD1Jbukr9Ry7vEYA/Xv5SPE=': 253059,
    'Pxavrzpw3sbkQ5EQHH8rya0+DvtUZXaZs2UeStI/edo=': 25583,
    'o3X6s/LFyOTLh0LVmEASjKQeiLEvZaMzmpPTay1DqDA=': 22550,
    'bZboZYDCWIYYoVJMaWZE/7K0pqZ0oyMW+W0HLU4t1xk=': 23012,
    'HztjDuWZe5eJhFzqyn3s+J25pOpOwr5ec5zVU+qnF1I=': 2516,
    'fm4rN2IbjOnqJ8EkybNHFkwuAzcOP9BfAkBK4SKAAE8=': 67713,
    'rnWuDVKfcim6WDqo05JDcoC1PqUkXqZl7PXbK7yTZHc=': 31360,
    'LGUFlbIZGNabHKfRr7NtSaOHXYBudrvjLN3Ag5H4OO8=': 142850,
    'jwmnD3U7t9qjzkiAwBIwrGRC0T2KG93LE2+G7SZVk+g=': 6657,
    'NfTJ098x2hmEhiDRqDSGcKv+fJJq0YrzeeBJbR3ThWg=': 19251,
    'sT9wASC96z2ZQ8ldeCOrl//Nr6JkrWjwYnqKV3YEId0=': 9367,
    'wMl9d/4MZgzqXcCsT26h/4XN1js9+BV8qW/RMke1vpU=': 1325,
    'ZoXbScZqwR0xDYjqCX5L8tG+iu6FoSO7gtrCjpNioG8=': 102621,
    'I9fhFmOkjHoenmjmdGY6hhY9X6wmBcNoWFYpTPVcrYk=': 157798,
    'f61vmkXUdKPy1UcATzZ49kBVlOFOLMOU06BKgNpgV4g=': 67447,
    'qLwP2v5M6T15xdI2od6yGoyc4II7laRxOHvVkRXDpBk=': 110818,
    'uj+85PpPMqGJgU8n1JN+cqbKfnzeRZGATZ6fgyfPwwc=': 167195,
    'BXEBeENbGpoC5O6g59KuHLahJuCKA0pm4CNN3YLH4d8=': 108381,
    '9yu1MswrNtoi7XBNWQvruOD409QHrJCevg90rMZno6U=': 43992,
    '9KyaMJ7qrQTrcLoy4wn0zgrsQ4nPy9U23fa+A+kCS+k=': 10374,
    'G7TW10hFg7zDyFeyt91BpKtnIL18Bru91+AdvowbMgk=': 7190,
    'tC82R1YdKUAMf5NCJb6jgk+7deza3B0Ifuv94ChAVvk=': 78590,
    'jzvp1eLkKRajci/Lwo7pswyQiSBojnoCVVrzVv2PUEI=': 35829,
    'KaQ1mciXo/MXKNoDTgFVMyKNeQw2PYuiodJx8J8Q5K4=': 21377,
    'RmnpT8uEDVX8j6c7xRLSI0dHm6ZG4KvXyTrRv2nVD24=': 57485,
    'iDv4AJIkhKSU81yTEKrvraiPMsDH9Vb/WisI/+B6qhA=': 39236,
    'IN8aFIYNoxllg+i/ndXNNh3W2nt5hRzwLgj2HG9E2TA=': 51770,
    'uz8izW3pSPTkqFYD/sXFd+6KfNaR1HpkB60spCEStw0=': 16235,
    '0V0PGIBkUdeNlIbngfl0jJcoKa4PVa9IFkznJZqFdTU=': 18020,
    'IOQsqcZPYqPv3Df9ty8oHTOuei7zu0eSUHbk/7rGSOM=': 64829,
    'vqJei4pxFdnyeZX3hAvfZG3vs3xABe4rRcG7uHpAB2s=': 69823,
    'zjXhWUjYBMozTceIENKCZcRbXwRY/uSudltXc5JUzsY=': 101956,
    '9scXEd1hQmuRJVTOrava4Pa0H95xiYt5qr0eiwx9ebs=': 56955,
    'ilxTM6F3gRpuVOQqdVMxd6MCJQOoTT42wamTbgN2vyg=': 31053,
    'S108okffJQpftIhQWG8rdfC3jLA1wTZtW53xEgBT2Vo=': 32190,
    'UupBBzkd+APbaVOjHTAgT3Mov+H4i1pVokX620ZnkTc=': 19383,
    'LX8EGI2kqLsLHLS01EeSscCBZDDlagQuA05gZjpCFr8=': 48442,
    'AuL8LS5YTuzScCnr6RcTwg5rfBiJnCw6dDF8g3M3oug=': 32254,
    'gnZc3doqiP2vGAqk0yjqhDb+HF7UHR0hTOsawJxaJVM=': 119799,
    'ngtCVKZI20LsoG3pmESNS9Qj+X1DeGofaki8lGcGqlo=': 11003,
    '1wpfUpw4AsWcWQ+FK7EwKdIdzt6bGLtgfnbFyHuYFhE=': 5171,
    'c3n3egyt5MyNT0IWPZQQ4IKBuN5fdjnS+aN77TFkwi8=': 225691,
    'RSCw5Yg6psLKxvaJO8Gx6gLHGmCHouYdUBwzHYW2wcU=': 187920,
    'LaLtKWIKIzzcpoqT9hdKlFHlTT8IJT+J8LpU29fhyUU=': 50463,
    'vSl4xHvIcvrX4R58HkPKCoIwhGgRUa1o0QIHHlnAwZ0=': 11514,
    'zpKuA7WmtNnIv+v+qYiPCRFjufNAX7TOLXam+Ym4HUM=': 31166,
    '68q48EEIIeIdJpNNkJ8DWQ3jKJzRuurbhsR0IXrO+Ac=': 5726,
    'hvNkFUrm+ChFum6hAm24CssRnZ6CBavkkJyUuOr63cs=': 59257,
    'c061cOpPvGfyZFuIgr9Ln7yewQLo+xJNHZpo0yXmRVw=': 18110,
    'YWupb/Kqp4EU30uNa40H/KRphSpCS797nQ6AJRrXO5U=': 22232,
    'ZGcU73fMWJFXP+mCL11CiSscAbN25TubsqWDWzK1rAo=': 57154,
    'ieZyv2N7gFatHs9y4L0GNVoadlFx28e6d0jC0fSAdvU=': 210322,
    'k2mFpNjaK5HqWpVKp4ZRm1xBzFM33TeNhZASRB/+CoM=': 73275,
    '/rDkiHHzfXdHFDJeLkD49rwewhpcfIa68jnh+XABqic=': 26805,
    '0uadHYjLvdAddqXKRTVBhw6zXZvEVRbJgvECorR9R18=': 79206,
    '0XmXsvMZOOMBYpDSzoVZDP3a5jYk4l6b69xiC9c0lf8=': 73565,
    '9FU4wf1a2xJT/92jyl1tau5vAqFz2oDvJLczLi0+en0=': 34519,
    'nIkNg8Mthhda6PP1gE1GwtfKUUUEzA/UqTJdderzCVc=': 79391,
    '+VpvEO6+G89FKclO5e8Q3a36cxLzaQkBRrYKTeHulLc=': 40212,
    'CUA1nB1KczM+/yn+3YQzeI19+KAyAiGX3vaTL//XkCc=': 45542,
    '9UT9tIdQxMQ1mEC6/AMRJhbUx6khFfZlMCnkIQ3LgmY=': 3855,
    'iO2XYizTydLH+jnVD82q/ZO/b6elI4C8wwSO8RBFKsc=': 14836,
    '903jf6xYMTo0wbUnXMPDGiKGGOkGKm2/elBxXjtAbfo=': 141624,
    'Ea8u+DtkSUyhp8OxJRLoxTI3lcZjLxwTHRrGXIZ3p2k=': 114427,
    'G70yGo2UR6iJ62w6BGWnO8bIuw/c9Q9cvKF024ZSKww=': 111450,
    'NmRIKU+WliiqfSHcfKdSOMMsK1FOANqoAqpI3IhRteM=': 68793,
    'P8g6GSI9fFTfP3NWRloXZF0Op4Q/A1UZcAKz0/MEe28=': 34106,
    'q/eLJdBLhxNc7MtgeYq8FoldOAGjaqZNAHjS5Dv9+rw=': 177938,
    '4Baz8PDLYec/VFDDoBWOr8Onb7Qb5MEz+m0IQjorhl4=': 4528,
    'Ao8sTLJwPqLaF7kGPh2wmlOjwXPOBDekXUeKwyXbwX0=': 15488,
    'tWm5QOmfpcRXZFRm0TA6PLZcyCR71WPUORN44aRpHCA=': 4520,
    'KCGpRn2XFtqpsIK5lMdXtZ9/tR8zeN+/mMKYqfZMrGM=': 31469,
    'Rb4YLaYK4ZGpMbp8a5Si/pI3zw+uTD3zaPMCaN4m9EI=': 17477,
    'wI8oaeQimDt8rztNPfImGToj79vbJzEIjOZm/HLcWF4=': 132584,
    'KRPyw1VveYRjwFH5g5AFprZ9Ij9lN2H52za1gkDgnJU=': 131427,
    'WSi0RrcefDOcdfx5SWxBhdhcpD49PpC29Ph70NmKehM=': 18363,
    'oZu9bc2CFvjkmLxSe/ueOfXzCr5qm0uWqUdywib/asE=': 8911,
    'GYO4Scuq7B6IIVkasmWD83eWKkkyfNQCOqsJh67yZ1g=': 54361,
    'VnZ3fccUx88dZ2o+UVbV0djwegp0qJq/NvQfjyKzjLg=': 38432,
    'poXMcTO5knP+PwzagjIJdqB/2KhedaHddcRHn1CvlfU=': 146399,
    '4UWsB2KASBWV5dYhcl5H95irgCL5f2PqInpDer4zhWA=': 86193
};

Class.register(TestBlockchain);
