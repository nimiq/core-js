describe('P2PClient',() => {
	const type = 42;
	const hash = new Hash(Dummy.hash1);
    const vec1 = new InvVector(type,hash);

	it('can send inv messages', (done) => {
		const client = new P2PClient({
			send: msg => {
				const invMsg = InvP2PMessage.unserialize(msg);
        		expect(invMsg.count).toBe(1);
        		expect(invMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			},
			on: () => {}
		});
		client.inv([vec1]);
	})

	it('can send notfound messages', (done) => {
		const client = new P2PClient({
			send: msg => {
				const invMsg = NotFoundP2PMessage.unserialize(msg);
        		expect(invMsg.count).toBe(1);
        		expect(invMsg.vectors[0].equals(vec1)).toBe(true);
				done();
			},
			on: () => {}
		});
		client.notfound([vec1]);
	})

	it('can receive notfound messages', (done) => {
		const spy = new SpyP2PChannel();

		const count = 1;
	    const vectorType = 888;
	    const vectorHash = new Hash(Dummy.hash2);
	    const vector1 = new InvVector(vectorType, vectorHash);

		const message = new InvP2PMessage(count, [vector1]);

		const client = new P2PClient(spy);
		client.on(message.type, messageTest => {
			done();

		});
		spy.fire('message', message);
	})
})


class SpyP2PChannel extends Observable{
	constructor(send){
		super();
		this.send = send || ( () => {} );
	}
}