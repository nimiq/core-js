if (typeof Dummy === 'undefined') {
    Dummy = {};
}

Dummy.block1 = (() => {

    function dummyTransaction(index) {
        const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy[`publicKey${index}`]));
        const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy[`address${index}`]));
        const value = 1;
        const fee = 1;
        const nonce = 1;
        const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy[`signature${index}`]));
        return new Transaction(senderPubKey, recipientAddr, value, fee, nonce, sign);
    }

    const transactions = [1, 2, 3].map(dummyTransaction);
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress, transactions);
    Dummy.block1 = body;


    const prevHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
    const bodyHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    Dummy.header1 = header;

    return new Block(header, body);
})();

Dummy.block2 = (async () => {

    function dummyTransaction(index){
        const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy[`publicKey${index}`]));
        const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy[`address${index}`]));
        const value = 1;
        const fee = 1;
        const nonce = 1;
        const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy[`signature${index}`]));
        return new Transaction(senderPubKey,recipientAddr,value,fee,nonce,sign);
    }

    const transactions = [];
    for (let i = 0; i < 10000; i++) {
        const transaction = dummyTransaction((i%3)+1);
        transactions.push(transaction);
    }

    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = await Block.GENESIS.hash();
    const bodyHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block3 = (async () => {

    function dummyTransaction(index){
        const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy[`publicKey${index}`]));
        const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy[`address${index}`]));
        const value = 1;
        const fee = 1;
        const nonce = 1;
        const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy[`signature${index}`]));
        return new Transaction(senderPubKey,recipientAddr,value,fee,nonce,sign);
    }

    const transactions = [1,1].map(dummyTransaction);
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = await Block.GENESIS.hash();
    const bodyHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block4 = (async () => {

    function dummyTransaction(index){
        const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy[`publicKey${index}`]));
        const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy[`address${index}`]));
        const value = 1;
        const fee = 1;
        const nonce = 1;
        const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy[`signature${index}`]));
        return new Transaction(senderPubKey,recipientAddr,value,fee,nonce,sign);
    }

    const transactions = [1,2,3].map(dummyTransaction);
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = await Block.GENESIS.hash();
    const bodyHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = Date.now() + Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX + 100000;
    const nonce = 1;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block5 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address1']));
    const value = 54740991;
    const fee = 1;
    const transactionNonce = 1;
    const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy['signature5']));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = await Block.GENESIS.hash();
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(2);
    const timestamp = 1;
    const nonce = 43998;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block6 = (async () => {

    function dummyTransaction(index){
        const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy[`publicKey${index}`]));
        const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy[`address${index}`]));
        const value = 1;
        const fee = 1;
        const nonce = 1;
        const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy[`signature${index}`]));
        return new Transaction(senderPubKey,recipientAddr,value,fee,nonce,sign);
    }

    const transactions = [1,2,3].map(dummyTransaction);
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = await Block.GENESIS.hash();
    const bodyHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 191973;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block7 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address1']));
    const value = 54740991;
    const fee = 1;
    const transactionNonce = 2;
    const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy['signature1']));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = await Block.GENESIS.hash();
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 111932;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block8 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address1']));
    const value = 54740991;
    const fee = 1;
    const transactionNonce = 1;
    const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy['signature5']));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);


    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = await Block.GENESIS.hash();
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64('FIh/SfMyXIz1ByNUBl33hWPKq3GItPhIoZhk07ItzOY='));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block9 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address1']));
    const value = 54740991;
    const fee = 1;
    const transactionNonce = 1;
    const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy['signature5']));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AAAfCrA9MPlPz5cfR/CSpxzRymtii6hDnYGeewpRnrA='));

    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 0;
    const nonce = 43403;
    const header = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block10 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address1']));
    const value = 54740991;
    const fee = 1;
    const transactionNonce = 2;
    const sign = Signature.unserialize(BufferUtils.fromBase64('bEOUL/8lswUPqy2QTyhdJmnGk3gDJZpKz5lhnE1sKcDdX6vhG04A2qDvwGJbJXzfd0GtL+9Vd6JdwFZMABHuWQ=='));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AAAfCrA9MPlPz5cfR/CSpxzRymtii6hDnYGeewpRnrA=')); // Block 8
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64('ZFLBx3Lr7qAY1KnGOraKNGz7BTnHwrXD1DuLvi3w5sY='));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 41229;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block10_2 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address1']));
    const value = 54740991;
    const fee = 1;
    const transactionNonce = 2;
    const sign = Signature.unserialize(BufferUtils.fromBase64('bEOUL/8lswUPqy2QTyhdJmnGk3gDJZpKz5lhnE1sKcDdX6vhG04A2qDvwGJbJXzfd0GtL+9Vd6JdwFZMABHuWQ=='));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AAAfCrA9MPlPz5cfR/CSpxzRymtii6hDnYGeewpRnrA=')); // Block 8
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 47334;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    //let i = 0;
    //do {
        //header.nonce = i++;
        //hash = await header.hash();
    //} while (parseInt(hash.toHex(), 16) > header.target)
        //console.log(header.nonce);

    return new Block(header,body);
})();

Dummy.block11 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address2']));
    const value = 5491;
    const fee = 1;
    const transactionNonce = 3;
    const sign = Signature.unserialize(BufferUtils.fromBase64('76SQLAiME3yzmePCN/FUbpaHov0kWPz1lIhyYTGIXuC2+nYvp/M+s99nKgMIYy4e/0AoQAe9Ya84hMR4w7dT/Q=='));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AAAEg/ITvgDI5QOBxuCFYj0ngLxCWu0jjGzeJzp96Wc=')); // Block 10
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64('2oI6jBc1Hpm3k/xF9xh/srwAXuBz5MJbBzb0Fqamb00='));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 128344;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block12 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address2']));
    const value = 3243342;
    const fee = 1;
    const transactionNonce = 4;
    const sign = Signature.unserialize(BufferUtils.fromBase64('rrC0HtSWEs4EAjC92zmr8znqcBEqqIDoxNvT6+KRE2nOe9qwMoRCnvgI2bkc4D1VS+vJGOfUdGIhJU4gpT0p+g=='));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AAC4teO1LuWkU+dG2PdR/KU+tc0oohQsL7s4g8uofQ8=')); // Block 11
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64('XlgVHCUFob+LDuWcN8Kg5i+lRLc+wVvOK9aYCgkOlPY='));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 75;
    const nonce = 7157;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block13 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address3']));
    const value = 9080246;
    const fee = 34;
    const transactionNonce = 5;
    const sign = Signature.unserialize(BufferUtils.fromBase64('Jrw5h2j7BwitMk7Z7pHgjzib4BQQooy6cyQYMg0bIJpemrK/9nETARUkJ4jOrEdGAnysINkKsX3VJSbCpUdTIA=='));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);


    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AACNpoANPy//hinQdtX42iZhZXjeXPBhJq6aoEv/HlE=')); // Block 12
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64('Ig72lEHq+dznaktutYF0hODvITRMXUsy8y0p0G2SrxE='));
    const difficulty = BlockUtils.difficultyToCompact(2);
    const timestamp = 80;
    const nonce = 70236;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block11_3 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address3']));
    const value = 32890;
    const fee = 1;
    const transactionNonce = 3;
    const sign = Signature.unserialize(BufferUtils.fromBase64('MeOftR8sB+sWesTFRURqbHVISEkBGzTJCalHnIO7gcXzq4v0GHzPEooUpaDIMyFv/Jki3/RR5c/SnT+LOBr27w=='));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AAAEg/ITvgDI5QOBxuCFYj0ngLxCWu0jjGzeJzp96Wc=')); // Block 10
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64('2oI6jBc1Hpm3k/xF9xh/srwAXuBz5MJbBzb0Fqamb00='));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 62142;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    return new Block(header,body);
})();

Dummy.block12_3 = (async () => {

    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy['publicKey5']));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy['address2']));
    const value = 87239;
    const fee = 32;
    const transactionNonce = 4;
    const sign = Signature.unserialize(BufferUtils.fromBase64('CRkVzgaLHavRrbxdE6604kvYj7C4Ac7LsmWC1iDO11WxMRyEWQ5XVpGcpOusWhCi+6sT1oV7aDpKhZqaytfTkg=='));
    const transaction = new Transaction(senderPubKey, recipientAddr, value, fee, transactionNonce, sign);

    const transactions = [transaction];
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress,transactions);

    const prevHash = Hash.unserialize(BufferUtils.fromBase64('AAA1EJUHjPB9Z2ZqwWetaTsrL78WQB+f9l+0YtopDLI=')); // Block 11_2
    const bodyHash = await body.hash();
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64('bb5RFlGu0GvvgizW7uJ/oGbABhs6iLrhdzN5enRRBGo='));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 38545;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    //let i = 0;
    //do {
        //header.nonce = i++;
        //hash = await header.hash();
    //} while (parseInt(hash.toHex(), 16) > header.target)
        //console.log(header.nonce);

    return new Block(header,body);
})();

// generator for header2
// async function _mine(header, buffer) {
//     // Reset the write position of the buffer before re-using it.
//     buffer.writePos = 0;
//
//     // Compute hash and check if it meets the proof of work condition.
//     const isPoW = await header.verifyProofOfWork(buffer);
//
//     // Check if we have found a block.
//     if (isPoW) {
//         // Tell listeners that we've mined a block.
//         return header;
//     } else {
//         // Increment nonce.
//         header.nonce++;
//         return await _mine(header, buffer);
//     }
// }
// const buffer = Dummy.header1.serialize();
// _mine(Dummy.header1, buffer).then(validHeader=>console.log(BufferUtils.toBase64(validHeader.serialize())));


Dummy.header2 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCSHKYzC8x+6cxgeoqnm7xDc4h7ZXpi9rJxOFQTqFvSG5EfqcM8IhyvbSvrTQysB2WOsfRZfa1dc1y70dJj0RZqQHwD//z/wAAAAAAAAQPfkEAAAAAA=';
Dummy.accountsHash = '0phe6k6vEXxH+7N2KPMGQD68xvReSG8rdy+aE20aFZo=';
Dummy.accountsBlock = (() => {

    function dummyTransaction(index) {
        const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy[`publicKey${index}`]));
        const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy[`address${index}`]));
        const value = 1;
        const fee = 1;
        const nonce = 1;
        const sign = Signature.unserialize(BufferUtils.fromBase64(Dummy[`signature${index}`]));
        return new Transaction(senderPubKey, recipientAddr, value, fee, nonce, sign);
    }

    const transactions = [1, 2, 3].map(dummyTransaction);
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const body = new BlockBody(minerAddress, transactions);
    Dummy.accountsBlock = body;


    const prevHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
    const bodyHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));
    const accountsHash = Hash.unserialize(BufferUtils.fromBase64(Dummy.accountsHash));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;
    const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

    Dummy.header3 = header;

    return new Block(header, body);
})();
