describe('Client', () => {
    /** @type {FullConsensus} */
    let otherConsensus;
    let testChain;
    let clients = {};
    let transactonRelayIntervalBak, freeTransactonRelayIntervalBak;
    
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
        transactonRelayIntervalBak = BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL;
        freeTransactonRelayIntervalBak = BaseConsensusAgent.FREE_TRANSACTION_RELAY_INTERVAL;
        BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL = 100;
        BaseConsensusAgent.FREE_TRANSACTION_RELAY_INTERVAL = 100;

        otherConsensus = await startOtherNode();
        for (const consensus of ['nano', 'light', 'full']) {
            clients[consensus] = startClient(consensus);
        }
    });

    afterAll(function () {
        BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL = transactonRelayIntervalBak;
        BaseConsensusAgent.FREE_TRANSACTION_RELAY_INTERVAL = freeTransactonRelayIntervalBak;
        MockClock.uninstall();
        MockNetwork.uninstall();
    });

    function allit(name, fn) {
        for (const consensus of ['nano', 'light', 'full']) {
            it(name + ' (' + consensus + ')', async (done) => {
                fn(done, await clients[consensus], consensus);
            });
        }
    }

    function established(name, fn) {
        allit(name, (done, client, consensus) => {
            client.addConsensusChangedListener(async state => {
                if (state === Client.ConsensusState.ESTABLISHED) {
                    fn(done, client, consensus);
                }
            });
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
        handle = client.addHeadChangedListener((hash => {
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
        handle = client.addTransactionListener((/** @type {TransactionDetails} */ tx) => {
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
        await client.sendTransaction(newTx);
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

});
