describe('P2PChannel', () => {
    const type = 42;
    const hash = new Hash(Dummy.hash1);
    const vec1 = new InvVector(type, hash);
    const count = 1;
    const message = new InvMessage(count, [vec1]);

    it('can send a InvMessage', (done) => {
        const spy = new SpyP2PChannel(msg => {
            const invMsg = InvMessage.unserialize(msg);
            expect(invMsg.count).toBe(1);
            expect(invMsg.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        const client = new P2PChannel(spy, '<TEST>');
        client.inv([vec1]);
    });

    it('can send a NotFoundMessage', (done) => {
        const spy = new SpyP2PChannel(msg => {
            const notFoundMsg = NotFoundMessage.unserialize(msg);
            expect(notFoundMsg.count).toBe(1);
            expect(notFoundMsg.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        const client = new P2PChannel(spy, '<TEST>');
        client.notfound([vec1]);
    });

    it('can send a GetDataMessage', (done) => {
        const spy = new SpyP2PChannel(msg => {
            const getDataMsg = GetDataMessage.unserialize(msg);
            expect(getDataMsg.count).toBe(1);
            expect(getDataMsg.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        const client = new P2PChannel(spy, '<TEST>');
        client.getdata([vec1]);
    });

    it('can send a BlockMessage', (done) => {
        const spy = new SpyP2PChannel(msg => {
            const blockMsg = BlockMessage.unserialize(msg);
            expect(blockMsg.block.header.equals(Dummy.block1.header)).toBe(true);
            expect(blockMsg.block.body.equals(Dummy.block1.body)).toBe(true);
            done();
        });
        const client = new P2PChannel(spy, '<TEST>');
        client.block(Dummy.block1);
    });

    it('can receive a InvMessage', (done) => {
        const message = new InvMessage(count, [vec1]);
        const spy = new SpyP2PChannel();
        const client = new P2PChannel(spy, '<TEST>');

        client.on(message.type, invMsgTest => {
            expect(invMsgTest.count).toBe(count);
            expect(invMsgTest.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        spy.onmessage(message.serialize());
    });

    it('can receive a NotFoundMessage', (done) => {
        const message = new NotFoundMessage(count, [vec1]);
        const spy = new SpyP2PChannel();
        const client = new P2PChannel(spy, '<TEST>');

        client.on(message.type, notfoundMsgTest => {
            expect(notfoundMsgTest.count).toBe(count);
            expect(notfoundMsgTest.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        spy.onmessage(message.serialize());
    });

    it('can receive a GetDataMessage', (done) => {
        const message = new GetDataMessage(count, [vec1]);
        const spy = new SpyP2PChannel();
        const client = new P2PChannel(spy, '<TEST>');

        client.on(message.type, getDataMsgTest => {
            expect(getDataMsgTest.count).toBe(count);
            expect(getDataMsgTest.vectors[0].equals(vec1)).toBe(true);
            done();
        });
        spy.onmessage(message.serialize());
    });

    it('can receive a BlockMessage', (done) => {
        const message = new BlockMessage(Dummy.block1);
        const spy = new SpyP2PChannel();
        const client = new P2PChannel(spy, '<TEST>');
        client.on(message.type, blockMsgTest => {
            expect(blockMsgTest.block.header.equals(Dummy.block1.header)).toBe(true);
            expect(blockMsgTest.block.body.equals(Dummy.block1.body)).toBe(true);
            done();
        });
        spy.onmessage(message.serialize());
    });
});

class SpyP2PChannel {
    constructor(send) {
        this.send = send || ( () => {} );
        this.onmessage = ( () => {
        } );
    }
}
