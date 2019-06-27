describe('Client', () => {
    /** @type {FullConsensus} */
    let otherConsensus;
    let testChain;
    let clients = {};

    function getConsensus(consensus) {
        const name = 'volatile' + consensus.charAt(0).toUpperCase() + consensus.slice(1);
        return Consensus[name]();
    }

    function startClient(consensus) {
        return new Client(Client.Configuration.builder().build(), getConsensus(consensus));
    }

    async function startOtherNode(numBlocks = 5) {
        const netconfig = Dummy.NETCONFIG;
        const consensus = await Consensus.volatileFull(netconfig);
        testChain = await TestBlockchain.createVolatileTest(numBlocks);
        for (let block of (await testChain.getBlocks(consensus.blockchain.headHash))) {
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

    established('can be used to fetch head height', async (done, client) => {
        expect(await client.getHeadHeight()).toBe(otherConsensus.blockchain.height);
        done();
    });

    established('can be used to fetch head hash', async (done, client) => {
        expect((await client.getHeadHash()).equals(otherConsensus.blockchain.headHash)).toBeTruthy();
        done();
    });

    established('can be used to fetch light head block', async (done, client) => {
        expect((await client.getHeadBlock(false)).toLight().equals(otherConsensus.blockchain.head.toLight())).toBeTruthy();
        done();
    });

    established('can be used to fetch full head block', async (done, client) => {
        expect((await client.getHeadBlock(true)).equals(otherConsensus.blockchain.head)).toBeTruthy();
        done();
    });

    established('can be used to fetch light block by hash', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlock(block.hash(), false)).toLight().equals(block.toLight())).toBeTruthy();
        done();
    });

    established('can be used to fetch full block by hash', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlock(block.hash(), true)).toLight().equals(block)).toBeTruthy();
        done();
    });

    established('can be used to fetch light block by height', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlockAt(block.height, false)).toLight().equals(block.toLight())).toBeTruthy();
        done();
    });

    established('can be used to fetch full block by height', async (done, client) => {
        const block = await otherConsensus.blockchain.getBlockAt(2);
        expect((await client.getBlockAt(block.height, true)).toLight().equals(block)).toBeTruthy();
        done();
    });

    allit('reports head changed', async (done, _, consensus) => {
        const client = startClient(consensus);
        let handle;
        handle = await client.addHeadChangedListener((hash => {
            if (hash.equals(otherConsensus.blockchain.headHash)) {
                client.removeListener(handle);
                done();
            }
        }));
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
        let establishedPico = false, syncingNano = false;
        client.addConsensusChangedListener((state) => {
            if (!establishedPico && state === Client.ConsensusState.ESTABLISHED) {
                establishedPico = true;
                client._onConsensusFailed();
            } else if (establishedPico && state === Client.ConsensusState.SYNCING) {
                syncingNano = true;
            } else if (establishedPico && state === Client.ConsensusState.ESTABLISHED) {
                expect(syncingNano).toBeTruthy();
                done();
            }
        });
    });

});
