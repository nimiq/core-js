describe('PeerChannel',() => {
	const type = 42;
	const hash = new Hash(Dummy.hash1);
    const vec1 = new InvVector(type,hash);
	const count = 1;
	const message = new InvMessage([vec1]);
	const addr = new NetAddress(0, 0, '', 0, 0, 0);

	it('can send a VersionMessage', (done) => {
		const spy = new SpyConnection( msg => {
				const vMsg = VersionMessage.unserialize(msg);
        		expect(vMsg.version).toBe(1);
        		expect(vMsg.netAddress.equals(addr)).toBe(true);
        		expect(vMsg.startHeight).toBe(42);
				done();
			});
		const client = new PeerChannel(spy);
		client.version(addr, 42);
	});

	it('can send a InvMessage', (done) => {
		const spy = new SpyConnection( msg => {
				const invMsg = InvMessage.unserialize(msg);
        		expect(invMsg.vectors.length).toBe(1);
        		expect(invMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			});
		const client = new PeerChannel(spy);
		client.inv([vec1]);
	});

	it('can send a NotFoundMessage', (done) => {
		const spy = new SpyConnection( msg => {
				const notFoundMsg = NotFoundMessage.unserialize(msg);
        		expect(notFoundMsg.vectors.length).toBe(1);
        		expect(notFoundMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			});
		const client = new PeerChannel(spy);
		client.notfound([vec1]);
	});

	it('can send a GetDataMessage', (done) => {
		const spy = new SpyConnection( msg => {
				const getDataMsg = GetDataMessage.unserialize(msg);
        		expect(getDataMsg.vectors.length).toBe(1);
        		expect(getDataMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			});
		const client = new PeerChannel(spy);
		client.getdata([vec1]);
	});

	it('can send a BlockMessage', (done) => {
		const spy = new SpyConnection( msg => {
				const blockMsg = BlockMessage.unserialize(msg);
        		expect(blockMsg.block.header.equals(Dummy.block1.header)).toBe(true);
        		expect(blockMsg.block.body.equals(Dummy.block1.body)).toBe(true);
				done();
			});
		const client = new PeerChannel(spy);
		client.block(Dummy.block1);
	});

	it('can send a TxMessage', (done) => {
		const spy = new SpyConnection( msg => {
				const txMsg = TxMessage.unserialize(msg);
        		expect(txMsg.transaction.equals(Dummy.block1.transactions[0])).toBe(true);
				done();
			});
		const client = new PeerChannel(spy);
		client.tx(Dummy.block1.transactions[0]);
	});

	it('can receive a InvMessage', (done) => {
		const message = new InvMessage([vec1]);
		const spy = new SpyConnection();
		const client = new PeerChannel(spy);

		client.on(message.type, invMsgTest => {
			expect(invMsgTest.vectors.length).toBe(count);
        	expect(invMsgTest.vectors[0].equals(vec1)).toBe(true);
			done();
		});
		spy.onmessage(message.serialize());
	});

	it('can receive a NotFoundMessage', (done) => {
		const message = new NotFoundMessage([vec1]);
		const spy = new SpyConnection();
		const client = new PeerChannel(spy);

		client.on(message.type, notfoundMsgTest => {
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

		client.on(message.type, getDataMsgTest => {
			expect(getDataMsgTest.vectors.length).toBe(count);
        	expect(getDataMsgTest.vectors[0].equals(vec1)).toBe(true);
			done();
		});
		spy.onmessage(message.serialize());
	});

	it('can receive a BlockMessage', (done) => {
		const message = new BlockMessage(Dummy.block1);
		const spy = new SpyConnection();
		const client = new PeerChannel(spy);
		client.on(message.type, blockMsgTest => {
        	expect(blockMsgTest.block.header.equals(Dummy.block1.header)).toBe(true);
        	expect(blockMsgTest.block.body.equals(Dummy.block1.body)).toBe(true);
			done();
		});
		spy.onmessage(message.serialize());
	});

	it('can receive a TxMessage', (done) => {
		const message = new TxMessage(Dummy.block1.transactions[0]);
		const spy = new SpyConnection();
		const client = new PeerChannel(spy);
		client.on(message.type, txMsgTest => {
        	expect(txMsgTest.transaction.equals(Dummy.block1.transactions[0])).toBe(true);
			done();
		});
		spy.onmessage(message.serialize());
	});
});
class SpyConnection extends Observable {
	constructor(send) {
		super();
		this.send = send || ( () => {} );
		this.onmessage = ( (msg) => { this.fire('message', msg); } );
	}
}
