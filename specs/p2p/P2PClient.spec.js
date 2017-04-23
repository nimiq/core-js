describe('P2PClient',() => {
	const type = 42;
	const hash = new Hash(Dummy.hash1);
    const vec1 = new InvVector(type,hash);
	const count = 1;
	const message = new InvP2PMessage(count, [vec1]);

	it('can send a InvP2PMessage', (done) => {
		const spy = new SpyP2PChannel( msg => {
				const invMsg = InvP2PMessage.unserialize(msg);
        		expect(invMsg.count).toBe(1);
        		expect(invMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			});
		const client = new P2PClient(spy);
		client.inv([vec1]);
	})

	it('can send a NotFoundP2PMessage', (done) => {
		const spy = new SpyP2PChannel( msg => {
				const notFoundMsg = NotFoundP2PMessage.unserialize(msg);
        		expect(notFoundMsg.count).toBe(1);
        		expect(notFoundMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			});
		const client = new P2PClient(spy);
		client.notfound([vec1]);
	})

	it('can send a GetDataP2PMessage', (done) => {
		const spy = new SpyP2PChannel( msg => {
				const getDataMsg = GetDataP2PMessage.unserialize(msg);
        		expect(getDataMsg.count).toBe(1);
        		expect(getDataMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			});
		const client = new P2PClient(spy);
		client.getdata([vec1]);
	})

	it('can send a BlockP2PMessage', (done) => {
		const spy = new SpyP2PChannel( msg => {
				const blockMsg = BlockP2PMessage.unserialize(msg);
        		expect(blockMsg.header.equals(Dummy.block1.header)).toBe(true);
        		expect(blockMsg.body.equals(Dummy.block1.body)).toBe(true);
				done();
			});
		const client = new P2PClient(spy);
		client.block(Dummy.block1);
	})

	it('can receive a InvP2PMessage', (done) => {
		const message = new InvP2PMessage(count, [vec1]);
		const spy = new SpyP2PChannel();
		const client = new P2PClient(spy);
		
		client.on(message.type, invMsgTest => {
			expect(invMsgTest.count).toBe(count);
        	expect(invMsgTest.vectors[0].equals(vec1)).toBe(true);
			done();
		});
		spy.fire('message', message.serialize());
	})

	it('can receive a NotFoundP2PMessage', (done) => {
		const message = new NotFoundP2PMessage(count, [vec1]);
		const spy = new SpyP2PChannel();
		const client = new P2PClient(spy);
		
		client.on(message.type, notfoundMsgTest => {
			expect(notfoundMsgTest.count).toBe(count);
        	expect(notfoundMsgTest.vectors[0].equals(vec1)).toBe(true);
			done();
		});
		spy.fire('message', message.serialize());
	});

	it('can receive a GetDataP2PMessage', (done) => {
		const message = new GetDataP2PMessage(count, [vec1]);
		const spy = new SpyP2PChannel();
		const client = new P2PClient(spy);
		
		client.on(message.type, getDataMsgTest => {
			expect(getDataMsgTest.count).toBe(count);
        	expect(getDataMsgTest.vectors[0].equals(vec1)).toBe(true);
			done();
		});
		spy.fire('message', message.serialize());
	});

	it('can receive a BlockP2PMessage', (done) => {
		const message = new BlockP2PMessage(Dummy.block1);
		const spy = new SpyP2PChannel();
		const client = new P2PClient(spy);
		client.on(message.type, blockMsgTest => {
			expect(blockMsgTest.count).toBe(count);
        	expect(blockMsgTest.block.header.equals(Dummy.block1.header)).toBe(true);
        	expect(blockMsgTest.block.body.equals(Dummy.block1.body)).toBe(true);
			done();
		});
		spy.fire('message', message.serialize());
	});
})


class SpyP2PChannel extends Observable{
	constructor(send){
		super();
		this.send = send || ( () => {} );
	}
}
