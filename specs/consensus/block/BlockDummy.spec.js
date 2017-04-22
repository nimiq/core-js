Dummy.Block = (() => {

    function dummyTransaction(index){	
    	const senderPubKey = new PublicKey(Dummy['publicKey'+index]);
    	const recipientAddr = new Address(Dummy['address'+index]);
    	const value = 1;
    	const fee = 1;
    	const nonce = 1;
    	const rawTx = new RawTransaction(senderPubKey,recipientAddr,value,fee,nonce);
    	const sign = new Signature(Dummy['signature'+index]);
    }

    const transactions = [1,2,3].map(dummyTransaction);
    const minerAddress = new Address(Dummy.address1);

    const body = new BlockBody(minerAddress,transactions);



})
