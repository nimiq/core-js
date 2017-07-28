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
        /*prevHash*/ new Hash(BufferUtils.fromBase64('AAAAATYsA336t60PBccUsP/iJSZhx4ILGVWzdSju9Yc=')),
        /*bodyHash*/ new Hash(BufferUtils.fromBase64('ClOhtalJMHSKFy4rhi+7UgUEzlfH+9chdEYODLWwogk=')),
        /*accountsHash*/ new Hash(BufferUtils.fromBase64('KAkqyQQ/pCScjB6fmMduz8EditURlvxIkdT6u67wk08=')),
        /*nBits*/ 487076242,
        /*height*/ 58001,
        /*timestamp*/ 1501112121,
        /*nonce*/ 297528927,
        /*version*/ 1),
    new BlockBody(new Address(BufferUtils.fromBase64('wP/uDKA/UmMdwK4/aUzaEP8I1/0=')), [])
);
Block.CHECKPOINT.hash().then(hash => {
    Block.CHECKPOINT.HASH = hash;
    //Object.freeze(Block.GENESIS);
});
Block.CHECKPOINT.TOTAL_WORK = 379468887.42374235;
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
    new Hash(BufferUtils.fromBase64('AAAAB8zYJ87usp2Av9+q0TN786BOhri3PS0M8aEvwIQ=')),
    new Hash(BufferUtils.fromBase64('AAAAAngMt24MYmSe2tfgfj1NV4Fv10BZXDPcDTZHuQM=')),
    new Hash(BufferUtils.fromBase64('AAAAA2trckpN5D7NlSQGJEDmx/1uQR3lRSlXmsKY2wE=')),
    new Hash(BufferUtils.fromBase64('AAAACmdt5K8AjlabxT0SOqNgCaA3b+B43q0MF7ppN7Q=')),
    new Hash(BufferUtils.fromBase64('AAAADEVHAPy+L7Mvy9YfiIYoWnLNd+uWUnVitoX0/tA=')),
    new Hash(BufferUtils.fromBase64('AAAABYQ5353h3Lv7juIk1FrjU1q0wZoZVnq7Ocuw8IA=')),
    new Hash(BufferUtils.fromBase64('AAAAFVMaIN3bMR/bqcr/G8AXExIbg41bd/iZaLTyhWY=')),
    new Hash(BufferUtils.fromBase64('AAAAAqBBrvzSgRg8shTLLUXYw6W/8Je0H276xGYJ5wU=')),
    new Hash(BufferUtils.fromBase64('AAAACThS7/pP1Cm3q2/yFDcDqSwx8O1kK7cwc2tuzAA=')),
    new Hash(BufferUtils.fromBase64('AAAADhidwr1dh+1mGY2FmZq6rWDs0amAQL1C7axonY0=')),
    new Hash(BufferUtils.fromBase64('AAAAAWQrgmCog7PJiXtpC6dvzPEHxuN8bOFbB1PZXwU=')),
    new Hash(BufferUtils.fromBase64('AAAAAOzbgj12KNWbd0YBCLLJVKoKpyWqiKqIeb0cWYY=')),
    new Hash(BufferUtils.fromBase64('AAAAA9Eri8IFB/UxwAyp5H/KjWUaCfkfsX6hOWGr4XI=')),
    new Hash(BufferUtils.fromBase64('AAAAANv1CnELj09i1h9GQS++H0dlDsmSpZlxRJnx+e0=')),
    new Hash(BufferUtils.fromBase64('AAAAAHNe8IMHwSAD1bexfg+oxitFhmv0ikCl+/cyqjI='))
]);
Class.register(Block);
