describe('P2PClient',() => {
	const type = 42;
	const hash = new Hash(Dummy.hash1);
    const vec1 = new InvVector(type,hash);
	const count = 1;
    const vectorType = 888;
    const vectorHash = new Hash(Dummy.hash2);
    const vector1 = new InvVector(vectorType, vectorHash);
	const message = new InvP2PMessage(count, [vector1]);

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

	it('can receive a InvP2PMessage', (done) => {
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
		const spy = new SpyP2PChannel();
		const client = new P2PClient(spy);
		
		client.on(message.type, invMsgTest => {
			expect(invMsgTest.count).toBe(count);
        	expect(invMsgTest.vectors[0].equals(vec1)).toBe(true);
			done();
		});
		spy.fire('message', message.serialize());
	});

	it('can receive a GetDataP2PMessage', (done) => {
		const spy = new SpyP2PChannel();
		const client = new P2PClient(spy);
		
		client.on(message.type, invMsgTest => {
			expect(invMsgTest.count).toBe(count);
        	expect(invMsgTest.vectors[0].equals(vec1)).toBe(true);
			done();
		});
		spy.fire('message', message.serialize());
	});

	it('can receive a BlockP2PMessage', (done) => {
		const spy = new SpyP2PChannel();
		const client = new P2PClient(spy);
		
		client.on(message.type, invMsgTest => {
			expect(invMsgTest.count).toBe(count);
        	expect(invMsgTest.vectors[0].equals(vec1)).toBe(true);
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