describe('RawTransaction.senderPubKey', () => {
	const recipientAddr = new Address();
	const value = 1; 
	const fee = 1; 
	const nonce = 0;

	it(' is set in the constructor',() => {
		const senderPubKey = new PublicKey();
		const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
		expect(tx.senderPubKey.equals(senderPubKey)).toEqual(true);
	});
});

describe('RawTransaction.value', () => {
	const senderPubKey = new PublicKey();
	const recipientAddr = new Address();
	const fee = 1; 
	const nonce = 0;

	it('may be positive',() => {
		const value = 1;
    	const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
		expect(tx.value).toEqual(value);
	});

	it('may not be zero',() => {
		const value = 0;
		expect( () => { 
    		const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
    	} ).toThrow('Malformed Value');
	});

	it('may not be negative',() => {
		const value = -1;
    	expect( () => { 
    		const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
    	} ).toThrow('Malformed Value');
	});
});

describe('RawTransaction.fee', () => {
	const senderPubKey = new PublicKey();
	const recipientAddr = new Address();
	const value = 1; 
	const nonce = 0;

	it('may be positive',() => {
		const fee = 1;
    	const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
		expect(tx.fee).toEqual(fee);
	});

	it('may not be zero',() => {
		const fee = 0;
		expect( () => { 
    		const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
    	} ).toThrow('Malformed Fee');
	});

	it('may not be negative',() => {
		const fee = -1;
    	expect( () => { 
    		const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
    	} ).toThrow('Malformed Fee');
	});
});

describe('RawTransaction.nonce', () => {
	const senderPubKey = new PublicKey();
	const recipientAddr = new Address();
	const value = 1;
	const fee = 10; 

	it('may be zero',() => {
		const nonce = 0;
    	const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
		expect(tx.nonce).toEqual(nonce);
	});

	it('may be positive',() => {
		const nonce = 1;
    	const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
		expect(tx.nonce).toEqual(nonce);
	});

	it('may not be negative',() => {
		const nonce = -1;
    	expect( () => { 
    		const tx = new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce); 
    	} ).toThrow('Malformed Nonce');
	});
});


describe('RawTransaction.serialize', () => {
	const senderPubKey = new PublicKey();
	const recipientAddr = new Address();
	const value = 1;    	// Wallet.sign(rawTx);

	const fee = 1; 
	const nonce = 1;

    it('is invariant to unserialize', () => {
    	const tx1 = new RawTransaction(senderPubKey,recipientAddr,value,fee,nonce); 
    	const tx2 = RawTransaction.unserialize(tx1.serialize());

    	expect(tx1.senderPubKey.equals(tx2.senderPubKey)).toEqual(true);
    	expect(tx1.recipientAddr.equals(tx2.recipientAddr)).toEqual(true);
    	expect(tx1.value).toEqual(value);
    	expect(tx1.fee).toEqual(fee);
    	expect(tx1.nonce).toEqual(nonce);
    });
});

describe('Transaction.serialize', () => {

    it('is invariant to unserialize', () => {
    	const senderPubKey = new PublicKey();
    	const recipientAddr = new Address();
    	const value = 1;
    	const fee = 1; 
    	const nonce = 1;
    	const rawTx = new RawTransaction(senderPubKey,recipientAddr,value,fee,nonce); 
    	const sign = new Signature();

    	// Wallet.sign(rawTx);

    	const tx1 = new Transaction(rawTx,sign);
    	const tx2 = Transaction.unserialize(tx1.serialize());

		expect(tx1.senderPubKey.equals(tx2.senderPubKey)).toEqual(true);
    	expect(tx1.recipientAddr.equals(tx2.recipientAddr)).toEqual(true);
    	expect(tx1.signature.equals(tx2.signature)).toEqual(true);
    	expect(tx1.value).toEqual(value);
    	expect(tx1.fee).toEqual(fee);
    	expect(tx1.nonce).toEqual(nonce);


    }); 
});