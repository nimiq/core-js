/* Genesis Block */
Block.GENESIS = new Block(
    new BlockHeader(
        new Hash(null),
        new Hash(null),
        Hash.fromBase64('z2Qp5kzePlvq/ABN31K1eUAQ5Dn8rpeZQU0PTQn9pH0='),
        Hash.fromBase64('jIdIsQkjXmPKtb0RM6sYZ6Tfq/Y7DPxEirBKYOhtH7k='),
        BlockUtils.difficultyToCompact(1),
        1,
        0,
        313530,
        BlockHeader.Version.V1),
    new BlockInterlink([], new Hash(null)),
    new BlockBody(Address.fromBase64('9KzhefhVmhN0pOSnzcIYnlVOTs0='), [])
);
Block.GENESIS.HASH = Hash.fromBase64('90SfoDkkc0+taLwtyuEM/Q2J4jvN24xmVnMr7ywaT4k=');

/* Genesis Accounts */
Accounts.GENESIS =
    'AAA=';
