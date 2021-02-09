describe('Client', () => {
    /** @type {FullConsensus} */
    let otherConsensus;
    let testChain;
    let clients = {};

    function getConsensus(consensus) {
        const name = 'volatile' + consensus.charAt(0).toUpperCase() + consensus.slice(1);
        const promise = Consensus[name]();
        promise.then((c) => {
            Log.d('Client.spec', `${consensus}-consensus uses ${c.network.config.peerAddress}`);
        });
        return promise;
    }

    function startClient(consensus) {
        return new Client(Client.Configuration.builder().build(), getConsensus(consensus));
    }

    async function startOtherNode(numBlocks = 5) {
        const netconfig = Dummy.NETCONFIG;
        const consensus = await Consensus.volatileFull(netconfig);
        testChain = await TestBlockchain.createVolatileTest(numBlocks);
        for (const block of (await testChain.getBlocks(consensus.blockchain.headHash))) {
            await consensus.blockchain.pushBlock(await testChain.getBlock(block.hash(), true, true));
        }
        consensus.network.connect();
        return consensus;
    }

    beforeAll(async function () {
        MockClock.install();
        MockNetwork.install();
        ConstantHelper.instance.set('BaseMiniConsensusAgent.MEMPOOL_DELAY_MIN', 5);
        ConstantHelper.instance.set('BaseMiniConsensusAgent.MEMPOOL_DELAY_MAX', 5);
        ConstantHelper.instance.set('FullConsensusAgent.MEMPOOL_DELAY_MIN', 5);
        ConstantHelper.instance.set('FullConsensusAgent.MEMPOOL_DELAY_MAX', 5);
        ConstantHelper.instance.set('BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL', 10);
        ConstantHelper.instance.set('BaseConsensusAgent.FREE_TRANSACTION_RELAY_INTERVAL', 10);
        ConstantHelper.instance.set('PicoConsensus.MIN_SYNCED_NODES', 1);

        otherConsensus = await startOtherNode();
        for (const consensus of ['pico', 'nano', 'light', 'full']) {
            clients[consensus] = startClient(consensus);
        }
    });

    afterAll(function () {
        otherConsensus.network.disconnect();
        ConstantHelper.instance.resetAll();
        MockClock.uninstall();
        MockNetwork.uninstall();
    });

    function allit(name, fn) {
        for (const consensus of ['pico', 'nano', 'light', 'full']) {
            it(`${name} (${consensus})`, async (done) => {
                fn(done, await clients[consensus], consensus);
            });
        }
    }

    function established(name, fn) {
        allit(name, (done, client, consensus) => {
            client
                .waitForConsensusEstablished()
                .then(() => fn(done, client, consensus));
        });
    }

    established('can establish and announce consensus', async (done, client) => {
        done();
    });

    established('can fetch head height', async (done, client) => {
        expect(await client.getHeadHeight()).toBe(otherConsensus.blockchain.height);
        done();
    });

    established('can fetch head hash', async (done, client) => {
        expect((await client.getHeadHash()).equals(otherConsensus.blockchain.headHash)).toBeTruthy();
        done();
    });

    established('can fetch light head block', async (done, client) => {
        expect((await client.getHeadBlock(false)).toLight().equals(otherConsensus.blockchain.head.toLight())).toBeTruthy();
        done();
    });

    established('can fetch full head block', async (done, client) => {
        expect((await client.getHeadBlock(true)).equals(otherConsensus.blockchain.head)).toBeTruthy();
        done();
    });

    established('can fetch light block by hash', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlock(block.hash(), false)).toLight().equals(block.toLight())).toBeTruthy();
        done();
    });

    established('can fetch full block by hash', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlock(block.hash(), true)).toLight().equals(block)).toBeTruthy();
        done();
    });

    established('can fetch light block by height', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlockAt(block.height, false)).toLight().equals(block.toLight())).toBeTruthy();
        done();
    });

    established('can fetch full block by height', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlockAt(block.height, true)).toLight().equals(block)).toBeTruthy();
        done();
    });

    established('can fetch an account', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(1, true);
        const account = (await otherConsensus.getAccounts([block.minerAddr]))[0];
        expect((await client.getAccount(block.minerAddr)).equals(account)).toBeTruthy();
        done();
    });

    established('can fetch multiple accounts', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2, true);
        const accounts = await otherConsensus.getAccounts([block.minerAddr, Address.NULL]);
        expect((await client.getAccounts([block.minerAddr, Address.NULL])).every((account, i) => accounts[i].equals(account))).toBeTruthy();
        done();
    });

    established('can fetch a transaction by hash', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2, true);
        const tx = block.transactions[0];
        expect((await client.getTransaction(tx.hash())).transaction.equals(tx)).toBeTruthy();
        done();
    });

    established('can fetch transactions by address', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(1, true);
        const receipts = await otherConsensus.getTransactionReceiptsByAddress(block.minerAddr, Infinity);
        const details = (await client.getTransactionsByAddress(block.minerAddr))
            .filter(detail => detail.state === Client.TransactionState.MINED || detail.state === Client.TransactionState.CONFIRMED);
        receipts.sort((a, b) => a.transactionHash.compare(b.transactionHash));
        details.sort((a, b) => a.transaction.hash().compare(b.transaction.hash()));
        expect(details.length).toBe(receipts.length);
        expect(details.every((detail, i) => {
            const receipt = receipts[i];
            return detail.transaction.hash().equals(receipt.transactionHash)
                && detail.blockHash.equals(receipt.blockHash)
                && detail.blockHeight === receipt.blockHeight;
        })).toBeTruthy();
        done();
    });

    established('can handle pending known transactions in getTransactionsByAddress', async (done, client) => {
        // Create a pending txDetail from a known mined detail (simulating a cached pending tx that has been mined in the meantime)
        const address = (await otherConsensus.blockchain.getBlockAt(1, true)).minerAddr;
        const minedTxDetails = await client.getTransactionsByAddress(address);
        const cachedTxDetail = new Client.TransactionDetails(minedTxDetails[0].transaction, Client.TransactionState.PENDING);

        // Create a new transaction
        const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
        const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
        const value = 1;
        const fee = 1;
        const validityStartHeight = 1;
        const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
        const networkId = 4;
        const newTx = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature, networkId);
        const newTxDetail = new Client.TransactionDetails(newTx, Client.TransactionState.NEW);

        // Request the history with the pending details passed in
        await client.getTransactionsByAddress(address, 1, [cachedTxDetail, newTxDetail]);
        done();
    });

    allit('reports head changed', async (done, _, consensus) => {
        const client = startClient(consensus);
        let handle;
        handle = await client.addHeadChangedListener(hash => {
            if (hash.equals(otherConsensus.blockchain.headHash)) {
                client.removeListener(handle);
                done();
            }
        });
    });

    established('can subscribe to mempool tx updates', async (done, /** @type {Client} */ client) => {
        const a = new Uint8Array(20);
        CryptoWorker.lib.getRandomValues(a);
        const newTx = TestBlockchain.createTransaction(testChain.users[0].publicKey, new Address(a), 1, 500, 1, testChain.users[0].privateKey);
        let handle;
        handle = await client.addTransactionListener((/** @type {TransactionDetails} */ tx) => {
            if (tx.transaction.equals(newTx)) {
                client.removeListener(handle);
                done();
            }
        }, [newTx.recipient]);
        await otherConsensus.mempool.pushTransaction(newTx);
    });

    established('can send transaction', async (done, client) => {
        const a = new Uint8Array(20);
        CryptoWorker.lib.getRandomValues(a);
        const newTx = TestBlockchain.createTransaction(testChain.users[0].publicKey, new Address(a), 1, 500, 1, testChain.users[0].privateKey);
        otherConsensus.mempool.on('transaction-added', (tx) => {
            if (tx.equals(newTx)) {
                done();
            }
        });
        /** @type {Client.TransactionDetails} */
        const tx = await client.sendTransaction(newTx);
        if (tx.state !== Client.TransactionState.PENDING && tx.state !== Client.TransactionState.NEW) {
            expect(false).toBeTruthy();
            done();
        }
    });

    established('can send free transaction', async (done, client) => {
        const a = new Uint8Array(20);
        CryptoWorker.lib.getRandomValues(a);
        const newTx = TestBlockchain.createTransaction(testChain.users[0].publicKey, new Address(a), 1, 0, 1, testChain.users[0].privateKey);
        otherConsensus.mempool.on('transaction-added', (tx) => {
            if (tx.equals(newTx)) {
                done();
            }
        });
        /** @type {Client.TransactionDetails} */
        const tx = await client.sendTransaction(newTx);
        if (tx.state !== Client.TransactionState.PENDING && tx.state !== Client.TransactionState.NEW) {
            expect(false).toBeTruthy();
            done();
        }
    });

    it('can replace consensus at runtime (nano to light)', async (done) => {
        const client = startClient('nano');
        let establishedNano = false, syncingLight = false;
        client.addConsensusChangedListener((state) => {
            if (!establishedNano && state === Client.ConsensusState.ESTABLISHED) {
                establishedNano = true;
                client._replaceConsensus(getConsensus('light'));
            } else if (establishedNano && state === Client.ConsensusState.SYNCING) {
                syncingLight = true;
            } else if (establishedNano && state === Client.ConsensusState.ESTABLISHED) {
                expect(syncingLight).toBeTruthy();
                done();
            }
        });
    });

    it('can replace consensus at runtime (pico failure)', async (done) => {
        const client = startClient('pico');
        let syncingNano = false;
        await client.waitForConsensusEstablished();
        await client.addConsensusChangedListener(async (state) => {
            if (state !== Client.ConsensusState.ESTABLISHED) {
                syncingNano = true;
            } else if (state === Client.ConsensusState.ESTABLISHED) {
                expect(syncingNano).toBeTruthy();
                done();
            }
        });
        client._onConsensusFailed();
    });

    it('can reset consensus', async(done) => {
        const client = startClient('pico');
        await client.waitForConsensusEstablished();
        await client.addConsensusChangedListener(async (state) => {
            if (state === Client.ConsensusState.ESTABLISHED) {
                done();
            }
        });
        await client.resetConsensus();
    });

});
