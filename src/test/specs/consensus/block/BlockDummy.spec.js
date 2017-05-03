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
    	const rawTx = new RawTransaction(senderPubKey,recipientAddr,value,fee,nonce);
    	const sign = new Signature(Dummy['signature'+index]);
        return new Transaction(rawTx,sign);
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
