if(typeof Dummy ==='undefined'){
    Dummy = {}
}

Dummy.block1 = (() => {

    function dummyTransaction(index){	
    	const senderPubKey = new PublicKey(Dummy['publicKey'+index]);
    	const recipientAddr = new Address(Dummy['address'+index]);
    	const value = 1;
    	const fee = 1;
    	const nonce = 1;
    	const sign = new Signature(Dummy['signature'+index]);
        return new Transaction(senderPubKey,recipientAddr,value,fee,nonce,sign);
    }

    const transactions = [1,2,3].map(dummyTransaction);
    const minerAddress = new Address(Dummy.address1);
    const body = new BlockBody(minerAddress,transactions);
    Dummy.block1 = body;
    

    const prevHash = new Hash(Dummy.hash1);
    const bodyHash = new Hash(Dummy.hash2);
    const accountsHash = new Hash(Dummy.hash3);
    const difficulty = 1;
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    Dummy.header1 = header;

    return new Block(header,body);
})();

Dummy.header2 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCSHKYzC8x+6cxgeoqnm7xDc4h7ZXpi9rJxOFQTqFvSG5EfqcM8IhyvbSvrTQysB2WOsfRZfa1dc1y70dJj0RZqQAAAAAT/wAAAAAAAAQAAAAAAAAAA=';