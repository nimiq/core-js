class Block {
    constructor(header, body) {
        if (!(header instanceof BlockHeader)) throw 'Malformed header';
        if (!(body instanceof BlockBody)) throw 'Malformed body';
        this._header = header;
        this._body = body;
    }

    static unserialize(buf) {
        const header = BlockHeader.unserialize(buf);
        const body = BlockBody.unserialize(buf);
        return new Block(header, body);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._header.serialize(buf);
        this._body.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return this._header.serializedSize
            + this._body.serializedSize;
    }

    get header() {
        return this._header;
    }

    get body() {
        return this._body;
    }

    get prevHash() {
        return this._header.prevHash;
    }

    get bodyHash() {
        return this._header.bodyHash;
    }

    get accountsHash() {
        return this._header.accountsHash;
    }

    get nBits() {
        return this._header.nBits;
    }

    get target() {
        return this._header.target;
    }

    get difficulty() {
        return this._header.difficulty;
    }

    get height() {
        return this._header.height;
    }

    get timestamp() {
        return this._header.timestamp;
    }

    get nonce() {
        return this._header.nonce;
    }

    get minerAddr() {
        return this._body.minerAddr;
    }

    get transactions() {
        return this._body.transactions;
    }

    get transactionCount() {
        return this._body.transactionCount;
    }

    hash() {
        return this._header.hash();
    }
}

/* Genesis Block */
Block.GENESIS = new Block(
    new BlockHeader(
        new Hash(null),
        new Hash(BufferUtils.fromBase64('Xmju8G32zjPl4m6U/ULB3Nyozs2BkVgX2k9fy5/HeEg=')),
        new Hash(BufferUtils.fromBase64('3OXA29ZLjMiwzb52dseSuRH4Reha9lAh4qfPLm6SF28=')),
        BlockUtils.difficultyToCompact(1),
        1,
        0,
        38760),
    new BlockBody(new Address(BufferUtils.fromBase64('kekkD0FSI5gu3DRVMmMHEOlKf1I')), [])
);
// Store hash for synchronous access
Block.GENESIS.HASH = Hash.fromBase64('AACIm7qoV7ybhlwQMvJrqjzSt5RJtq5++xi8jg91jfU=');
Block.GENESIS.hash().then(hash => {
    Block.GENESIS.HASH = hash;
    //Object.freeze(Block.GENESIS);
});

/* Checkpoint Block */
Block.CHECKPOINT = new Block(
    new BlockHeader(
        new Hash(BufferUtils.fromBase64('AAAAAtSCUsJPWRSU3bBdWO05QKWjfyww5LhdAg01QC4=')),
        new Hash(BufferUtils.fromBase64('DTYnX+Vf1ps/vA9PWBy0raEcQOCqjUy4N5H/0AcP54w=')),
        new Hash(BufferUtils.fromBase64('lVAOIc4MdxuXM472DoF2hPbolmYIcOxUNXE2zwvs5XE=')),
        488323620,
        5801,
        1497166215,
        1554547,
        1),
    new BlockBody(new Address(BufferUtils.fromBase64('mOoPdUsZHV0hcd7js9SFKPZH/wI=')), [
        Transaction.unserialize(BufferUtils.fromBase64('AAEAtKYJ6YL6xGiv6b5DvFVbp7QYAKa+QG1bRdftz6aqqce6kbU79DdvzMq8GJs8yFtLBcCGSr51U7L1QrmSFOLcysLQnv5fnlAOfKNKOjyTTSTiUFOgQfKgXyAAAAAAAAAAAAAAAAAAAAQ8OQFTMQWD4pp7SSBoVICMLUv82mqYG47w7/IBMwqz9D9NH0aG+QNqMHE9tZHkFbTCtQQUpZ861AKQdy4eG2ul'))
    ])
);
Block.CHECKPOINT.hash().then(hash => {
    Block.CHECKPOINT.HASH = hash;
    //Object.freeze(Block.GENESIS);
});
//Block.CHECKPOINT.TOTAL_WORK = 17711565.212913718;
Class.register(Block);
