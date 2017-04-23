describe('RawTransaction', () => {
	const senderPubKey = new PublicKey(Dummy.publicKey1);
	const recipientAddr = new Address(Dummy.address1);
	const value = 1;
	const fee = 1;
	const nonce = 1;
	
	it('is 101 bytes long', ()=>{
	 	/*
            65 bytes senderPubKey
            20 bytes recipientAddress
             8 bytes value
             4 bytes fee
             4 bytes nonce
           ---------------------------- 
           101 bytes
	 	*/
	 	
    	const transaction1 = new RawTransaction(senderPubKey,recipientAddr,value,fee,nonce);
    	const serialized = transaction1.serialize();
        expect(serialized.byteLength).toBe(101);
    });

    it('is serializable and unserializable', () => {
    	const tx1 = new RawTransaction(senderPubKey,recipientAddr,value,fee,nonce);
    	const tx2 = RawTransaction.unserialize(tx1.serialize());

    	expect(tx2.senderPubKey.equals(senderPubKey)).toEqual(true);
    	expect(tx2.recipientAddr.equals(recipientAddr)).toEqual(true);
    	expect(tx2.value).toEqual(value);
    	expect(tx2.fee).toEqual(fee);
    	expect(tx2.nonce).toEqual(nonce);
    });
    
    it('must have a well defined senderPubKey (65 bytes)', () => {
        expect( () => {
            const test1 = new RawTransaction(undefined,recipientAddr,value,fee,nonce);
        }).toThrow('Malformed senderPubKey');
        expect( () => {
            const test2 = new RawTransaction(null,recipientAddr,value,fee,nonce);
        }).toThrow('Malformed senderPubKey');
        expect( () => {
            const test3 = new RawTransaction(true,recipientAddr,value,fee,nonce);
        }).toThrow('Malformed senderPubKey');
        expect( () => {
            const test4 = new RawTransaction(new Address(),recipientAddr,value,fee,nonce);
        }).toThrow('Malformed senderPubKey');
        expect( () => {
            const test5 = new RawTransaction(new Signature(),recipientAddr,value,fee,nonce);
        }).toThrow('Malformed senderPubKey');
        expect( () => {
            const test5 = new RawTransaction(new Uint8Array(65),recipientAddr,value,fee,nonce);
        }).toThrow('Malformed senderPubKey');
    });  

    it('must have a well defined recipientAddr (20 bytes)', () => {
        expect( () => {
            const test1 = new RawTransaction(senderPubKey, undefined,value,fee,nonce);
        }).toThrow('Malformed recipientAddr');
        expect( () => {
            const test2 = new RawTransaction(senderPubKey, null,value,fee,nonce);
        }).toThrow('Malformed recipientAddr');
        expect( () => {
            const test3 = new RawTransaction(senderPubKey, true,value,fee,nonce);
        }).toThrow('Malformed recipientAddr');
        expect( () => {
            const test4 = new RawTransaction(senderPubKey, new PublicKey(),value,fee,nonce);
        }).toThrow('Malformed recipientAddr');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, new Signature(),value,fee,nonce);
        }).toThrow('Malformed recipientAddr');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, new Uint8Array(20),value,fee,nonce);
        }).toThrow('Malformed recipientAddr');
    });

    it('must have a well defined value (8 bytes)', () => {
        expect( () => {
            const test1 = new RawTransaction(senderPubKey, recipientAddr, undefined,fee,nonce);
        }).toThrow('Malformed value');
        expect( () => {
            const test2 = new RawTransaction(senderPubKey, recipientAddr, null,fee,nonce);
        }).toThrow('Malformed value');
        expect( () => {
            const test3 = new RawTransaction(senderPubKey, recipientAddr, true,fee,nonce);
        }).toThrow('Malformed value');
        expect( () => {
            const test4 = new RawTransaction(senderPubKey, recipientAddr, -20,fee,nonce);
        }).toThrow('Malformed value');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, 0,fee,nonce);
        }).toThrow('Malformed value');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, new Uint8Array(20),fee,nonce);
        }).toThrow('Malformed value');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, Number.MAX_SAFE_INTEGER+1,fee,nonce);
        }).toThrow('Malformed value');
    });  

    it('must have a well defined fee (4 bytes)', () => {
        expect( () => {
            const test1 = new RawTransaction(senderPubKey, recipientAddr, value, undefined,nonce);
        }).toThrow('Malformed fee');
        expect( () => {
            const test2 = new RawTransaction(senderPubKey, recipientAddr, value, null,nonce);
        }).toThrow('Malformed fee');
        expect( () => {
            const test3 = new RawTransaction(senderPubKey, recipientAddr, value, true,nonce);
        }).toThrow('Malformed fee');
        expect( () => {
            const test4 = new RawTransaction(senderPubKey, recipientAddr, value, -20,nonce);
        }).toThrow('Malformed fee');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, value, 0,nonce);
        }).toThrow('Malformed fee');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, value, new Uint8Array(20),nonce);
        }).toThrow('Malformed fee');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, value, Number.MAX_SAFE_INTEGER-1,nonce);
        }).toThrow('Malformed fee');
    });  

    it('must have a well defined nonce (4 bytes)', () => {
        expect( () => {
            const test1 = new RawTransaction(senderPubKey, recipientAddr, value, fee, undefined);
        }).toThrow('Malformed nonce');
        expect( () => {
            const test2 = new RawTransaction(senderPubKey, recipientAddr, value, fee, null);
        }).toThrow('Malformed nonce');
        expect( () => {
            const test3 = new RawTransaction(senderPubKey, recipientAddr, value, fee, true);
        }).toThrow('Malformed nonce');
        expect( () => {
            const test4 = new RawTransaction(senderPubKey, recipientAddr, value, fee, -20);
        }).toThrow('Malformed nonce');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, value, fee, new Uint8Array(20));
        }).toThrow('Malformed nonce');
        expect( () => {
            const test5 = new RawTransaction(senderPubKey, recipientAddr, value, fee, Number.MAX_SAFE_INTEGER-1);
        }).toThrow('Malformed nonce');

    });  
});



describe('Transaction', () => {
    const senderPubKey = new PublicKey(Dummy.publicKey1);
    const recipientAddr = new Address(Dummy.address1);
    const value = 1;
    const fee = 1;
    const nonce = 1;
    const rawTx = new RawTransaction(senderPubKey,recipientAddr,value,fee,nonce);
    const signature = new Signature(Dummy.signature1);

     it('is 165 bytes long', ()=>{
        
        /*
            65 bytes senderPubKey
            20 bytes recipientAddress
             8 bytes value
             4 bytes fee
             4 bytes nonce
            64 bytes signature
           ---------------------------- 
           165 bytes
        */
        
        const transaction1 = new Transaction(rawTx,signature);
        const serialized = transaction1.serialize();
        expect(serialized.byteLength).toBe(165);
    });

    it('is serializable and unserializable', () => {
        const tx1 = new Transaction(rawTx,signature);
        const tx2 = Transaction.unserialize(tx1.serialize());

        expect(tx2.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx2.recipientAddr.equals(recipientAddr)).toEqual(true);
        expect(tx2.signature.equals(signature)).toEqual(true);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.nonce).toEqual(nonce);
    });

    it('can falsify an invalid signature', (done) => {
        const tx1 = new Transaction(rawTx,signature);
        
        tx1.verify()
            .then( () => {})
            .catch(e => {
                expect(e).toEqual('Invalid signature');
                done();
            })
    })

    it('verify a valid signature', (done) => {
        expect(true).toBe(false,'because we need to hardcode a signed signature into the specs')
    })
});
