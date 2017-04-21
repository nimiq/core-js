describe('Crypto', () => {
    it('can sign and verify data', (done) => {
		const dataToSign = BufferUtils.fromUnicode('test data to sign');
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
		const dataToSign = BufferUtils.fromUnicode('test data to sign');
		const wrongData = BufferUtils.fromUnicode('wrong test data to sign');
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
		const dataToHash = BufferUtils.fromUnicode('hello');
		const expectedHash = new Hash(BufferUtils.fromUnicode('5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'))
		Crypto.sha256(dataToHash)
            .then(hash => {
				expect(hash.equals(expectedHash)).toEqual(true);
				done();
            })
    }); 
});