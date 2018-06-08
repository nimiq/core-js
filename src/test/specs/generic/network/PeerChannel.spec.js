describe('PeerChannel', () => {
    const type = 42;
    const hash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
    const vec1 = new InvVector(type, hash);
    const count = 1;
    const addr = new WssPeerAddress(Services.DEFAULT, Date.now(), NetAddress.UNSPECIFIED, PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), 1, 'node1.nimiq.com', 8443, Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1)));

    it('can send a VersionMessage', (done) => {
        const challenge = new Uint8Array(VersionMessage.CHALLENGE_SIZE);
        (async function () {
            // We need this to prevent a race condition where a new
            // VersionMessage would be created before GenesisConfig.GENESIS_HASH
            // is set in the object
            const spy = new SpyConnection(msg => {
                const vMsg = VersionMessage.unserialize(msg);
                expect(vMsg.version).toBe(Version.CODE);
                expect(vMsg.peerAddress.equals(addr)).toBe(true);
                expect(vMsg.headHash.equals(hash)).toBe(true);
                expect(BufferUtils.equals(vMsg.challengeNonce, challenge)).toBe(true);
            });
            const client = new PeerChannel(spy);
            client.version(addr, hash, challenge);
        })().then(done, done.fail);
    });

    it('can send a InvMessage', (done) => {
        const spy = new SpyConnection(msg => {
            const invMsg = InvMessage.unserialize(msg);
            expect(invMsg.vectors.length).toBe(1);
            expect(invMsg.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        const client = new PeerChannel(spy);
        client.inv([vec1]);
    });

    it('can send a MempoolMessage', (done) => {
        const spy = new SpyConnection(msg => {
            const memPoolMsg = MempoolMessage.unserialize(msg);
            expect(memPoolMsg.type).toBe(Message.Type.MEMPOOL);
            done();
        });
        const client = new PeerChannel(spy);
        client.mempool();
    });

    it('can send a NotFoundMessage', (done) => {
        const spy = new SpyConnection(msg => {
            const notFoundMsg = NotFoundMessage.unserialize(msg);
            expect(notFoundMsg.vectors.length).toBe(1);
            expect(notFoundMsg.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        const client = new PeerChannel(spy);
        client.notFound([vec1]);
    });

    it('can send a GetDataMessage', (done) => {
        const spy = new SpyConnection(msg => {
            const getDataMsg = GetDataMessage.unserialize(msg);
            expect(getDataMsg.vectors.length).toBe(1);
            expect(getDataMsg.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        const client = new PeerChannel(spy);
        client.getData([vec1]);
    });

    it('can send a BlockMessage', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const block = await testBlockchain.createBlock();
            const spy = new SpyConnection(msg => {
                const blockMsg = BlockMessage.unserialize(msg);
                expect(blockMsg.block.header.equals(block.header)).toBe(true);
                expect(blockMsg.block.body.equals(block.body)).toBe(true);
            });
            const client = new PeerChannel(spy);
            client.block(block);
        })().then(done, done.fail);
    });

    it('can send a TxMessage', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const block = await testBlockchain.createBlock();
            const spy = new SpyConnection(msg => {
                const txMsg = TxMessage.unserialize(msg);
                expect(txMsg.transaction.equals(block.transactions[0])).toBe(true);
            });
            const client = new PeerChannel(spy);
            client.tx(block.transactions[0]);
        })().then(done, done.fail);
    });

    it('can receive a InvMessage', (done) => {
        const message = new InvMessage([vec1]);
        const spy = new SpyConnection();
        const client = new PeerChannel(spy);

        client.on('inv', invMsgTest => {
            expect(invMsgTest.vectors.length).toBe(count);
            expect(invMsgTest.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        spy.onmessage(message.serialize());
    });

    it('can receive a MempoolMessage', (done) => {
        const message = new MempoolMessage();
        const spy = new SpyConnection();
        const client = new PeerChannel(spy);

        client.on('mempool', memPoolMsgTest => {
            expect(memPoolMsgTest.type).toBe(Message.Type.MEMPOOL);
            done();
        });
        spy.onmessage(message.serialize());
    });

    it('can receive a NotFoundMessage', (done) => {
        const message = new NotFoundMessage([vec1]);
        const spy = new SpyConnection();
        const client = new PeerChannel(spy);

        client.on('not-found', notfoundMsgTest => {
            expect(notfoundMsgTest.vectors.length).toBe(count);
            expect(notfoundMsgTest.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        spy.onmessage(message.serialize());
    });

    it('can receive a GetDataMessage', (done) => {
        const message = new GetDataMessage([vec1]);
        const spy = new SpyConnection();
        const client = new PeerChannel(spy);

        client.on('get-data', getDataMsgTest => {
            expect(getDataMsgTest.vectors.length).toBe(count);
            expect(getDataMsgTest.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        spy.onmessage(message.serialize());
    });

    it('can receive a BlockMessage', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const block = await testBlockchain.createBlock();
            const message = new BlockMessage(block);
            const spy = new SpyConnection();
            const client = new PeerChannel(spy);
            client.on('block', blockMsgTest => {
                expect(blockMsgTest.block.header.equals(block.header)).toBe(true);
                expect(blockMsgTest.block.body.equals(block.body)).toBe(true);
            });
            spy.onmessage(message.serialize());
        })().then(done, done.fail);
    });

    it('can receive a TxMessage', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const block = await testBlockchain.createBlock();
            const message = new TxMessage(block.transactions[0]);
            const spy = new SpyConnection();
            const client = new PeerChannel(spy);
            client.on('tx', txMsgTest => {
                expect(txMsgTest.transaction.equals(block.transactions[0])).toBe(true);
            });
            spy.onmessage(message.serialize());
        })().then(done, done.fail);
    });
});
class SpyConnection extends Observable {
    constructor(send, ban) {
        super();
        this.send = send || (() => {});
        this.ban = ban || (() => { throw 'Spy was banned unexpectedly.';});
        this.onmessage = ( (msg) => {
            this.fire('message', msg);
        } );
        this.confirmExpectedMessage = () => {};
    }
}
