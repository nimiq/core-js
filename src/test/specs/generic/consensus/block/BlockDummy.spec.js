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
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    Dummy.header1 = header;

    return new Block(header,body);
})();

/*
generator for header2
async function _mine(header, buffer) {
    // Reset the write position of the buffer before re-using it.
    buffer.writePos = 0;

    // Compute hash and check if it meets the proof of work condition.
    const isPoW = await header.verifyProofOfWork(buffer);

    // Check if we have found a block.
    if (isPoW) {
        // Tell listeners that we've mined a block.
        return header;
    } else {
        // Increment nonce.
        header.nonce++;
        return await _mine(header, buffer);
    }
}
const buffer = Dummy.header1.serialize();
_mine(Dummy.header1, buffer).then(validHeader=>console.log(BufferUtils.toBase64(validHeader.serialize())));
*/

Dummy.header2 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCSHKYzC8x+6cxgeoqnm7xDc4h7ZXpi9rJxOFQTqFvSG5EfqcM8IhyvbSvrTQysB2WOsfRZfa1dc1y70dJj0RZqQHwD//z/wAAAAAAAAQPfkEAAAAAA=';
Dummy.accountsHash = '1bX0xXTjWUUV/Ax1CNWaRq0/pO94FCF1bUwnG+VT88Q=';
Dummy.accountsBlock = (() => {

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
    Dummy.accountsBlock = body;
    

    const prevHash = new Hash(Dummy.hash1);
    const bodyHash = new Hash(Dummy.hash2);
    const accountsHash = new Hash(Dummy.accountsHash);
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    Dummy.header3 = header;

    return new Block(header,body);
})();