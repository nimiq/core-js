describe('Crypto', () => {

	it('can create 65 byte publicKeys', (done) => {
		Crypto.generateKeys()
		    .then(keys => Crypto.exportPublic(keys.publicKey)
		    .then(publicKey =>  {
				expect(publicKey.byteLength).toEqual(65);
				done();
            }))
    }); 


    it('can sign and verify data', (done) => {
    	// http://www.ietf.org/rfc/rfc6090.txt
		const dataToSign = BufferUtils.fromAscii('test data to sign');
		Crypto.generateKeys()
		    .then(keys => Crypto.exportPublic(keys.publicKey)
		    	.then(publicKey => Crypto.sign(keys.privateKey,dataToSign)
		    		.then(signature => Crypto.verify(publicKey,signature,dataToSign))
			            .then(proof => {
							expect(proof).toEqual(true);
							done();
			            })))
    }); 

	it('can detect wrong signatures', (done) => {
		const dataToSign = BufferUtils.fromAscii('test data to sign');
		const wrongData = BufferUtils.fromAscii('wrong test data to sign');
		Crypto.generateKeys()
		    .then(keys => Crypto.exportPublic(keys.publicKey)
		    	.then(publicKey => Crypto.sign(keys.privateKey,dataToSign)
		    		.then(signature => Crypto.verify(publicKey,signature,wrongData))
			            .then(proof => {
							expect(proof).toEqual(false);
							done();
			            })))
    });     

    it('can hash data with sha256', (done) => {
		const dataToHash = BufferUtils.fromAscii('hello');
		const expectedHash = Dummy.hash1;
		Crypto.sha256(dataToHash).then( hash => {
			expect( BufferUtils.toBase64(hash) ).toBe(expectedHash);
			done();
        })
    }); 
});