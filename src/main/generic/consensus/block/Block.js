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
        /*prevHash*/ new Hash(BufferUtils.fromBase64('AAAABpIXcesz/mNQ9TKL8yqUR0a0CPDYzNiRSWERxyU=')),
        /*bodyHash*/ new Hash(BufferUtils.fromBase64('NuwsWq2rTM6SfRbwKdQpkV5dmzatJ1b08wHlO9tyIoM=')),
        /*accountsHash*/ new Hash(BufferUtils.fromBase64('uax9x3drU8PLGp0H84rmLr/VihQtp+vNpUNXL8g4JbA=')),
        /*nBits*/ 487384874,
        /*height*/ 34601,
        /*timestamp*/ 1499329092,
        /*nonce*/ 75033,
        /*version*/ 1),
    new BlockBody(new Address(BufferUtils.fromBase64('kQBoPTKKv6fVYo9W3yTrTfr4618=')), [])
);
Block.CHECKPOINT.hash().then(hash => {
    Block.CHECKPOINT.HASH = hash;
    //Object.freeze(Block.GENESIS);
});
Block.CHECKPOINT.TOTAL_WORK = 122533849.45281257;
Block.OLD_CHECKPOINTS = new IndexedArray([
    new Hash(BufferUtils.fromBase64('AAAACxKJIIfQb99dTIuiRyY6VkRlzBfbyknKo/515Ho=')),
    new Hash(BufferUtils.fromBase64('AAAAJHtA0SSxZb+sk2T9Qtzz4bWZdfz8pqbf5PNjywI=')),
    new Hash(BufferUtils.fromBase64('AAAALktDkTyMegm9e/CJG9NpkvF/7uPxp9q+zErQnl8=')),
    new Hash(BufferUtils.fromBase64('AAAABmq1g68uEMzKWLDBUa6810XEE9Vk/ifONRCUkUk=')),
    new Hash(BufferUtils.fromBase64('AAAAHpEZUIClGOSOrqjKJ+THcp8xyN4+5U2rvHlEkvw=')),
    new Hash(BufferUtils.fromBase64('AAAAFenBDl6b49lyL33tpV8eLzWf1dYIM8+9pxEGRfY=')),
    new Hash(BufferUtils.fromBase64('AAAABePxtVLWdRrzjxUmRGVPym7zuImTZEGMvZaRNEs=')),
    new Hash(BufferUtils.fromBase64('AAAAH4mCyHqdb+rcy0VDptF0CfLugU+gKYDA7oPuhWI=')),
    new Hash(BufferUtils.fromBase64('AAAAABu3j9L0ol18IHG25YMi4lHVyGwa5QJGrQJy4Qw=')),
    new Hash(BufferUtils.fromBase64('AAAAARX1b4n0Y1+dzdEU4cZW7GNvxKUEalDtH1vSsx8=')),
    new Hash(BufferUtils.fromBase64('AAAABH7wDY5FwWZho3QllcGRNveaOSoSwvybunpXoAc=')),
    new Hash(BufferUtils.fromBase64('AAAAFqUCFCnUYyybeKyAJuTBhtB29dOUHlo9W31TxPA=')),
    new Hash(BufferUtils.fromBase64('AAAAA+mSyp2Q3JsT5W5PbCLVHzGd3EsLMzkqSFt4AwM=')),
    new Hash(BufferUtils.fromBase64('AAAAAjFm8OCWhfzH2acJntnz921z15yxb5E+bh1N7k4=')),
    new Hash(BufferUtils.fromBase64('AAAAAIVQSMwa5TcuGg6t28wSQyijwBEhEMddTiNFNfw=')),
    new Hash(BufferUtils.fromBase64('AAAACfynhTg1AE83lWY0Il009MauEBohEWvpuJq9JjM=')),
    new Hash(BufferUtils.fromBase64('AAAADiUfwIOxDrscPaQKWXnt8JOQZ4igiJ08mMLB83k=')),
    new Hash(BufferUtils.fromBase64('AAAAAaviQ4P5/8HjNtl1Ixf2YQrqK2cBuGo1eM4gEvQ=')),
    new Hash(BufferUtils.fromBase64('AAAABs5JgeROyc2m8Q5ipp8zZ43VooArfOdXC4PBEl8=')),
    new Hash(BufferUtils.fromBase64('AAAAAMPvFcUV8nPAB2ggkJeFvP73SAPwNHoC1I1I+sA=')),
    new Hash(BufferUtils.fromBase64('AAAACOVTDF5/5y8bsaIbhJidyEzQEYfsh4cMFZ1TAew=')),
    new Hash(BufferUtils.fromBase64('AAAADrTB/DfobRJSPRwG4XKArX0Na3J03OvVJWhunJI=')),
    new Hash(BufferUtils.fromBase64('AAAABomr61e4IFqwoAh8s8yUXbYNedG/WLW7aHDZzco=')),
    new Hash(BufferUtils.fromBase64('AAAAB8zYJ87usp2Av9+q0TN786BOhri3PS0M8aEvwIQ='))
]);
Class.register(Block);
