/* Genesis Block */
Block.GENESIS = new Block(
    new BlockHeader(
        new Hash(null),
        new Hash(null),
        Hash.fromBase64('giOIYTBojKQPmBLq5msCgObOL3KnQ9CKrIGb5HWz7E8='),
        Hash.fromBase64('xexmOOk+2oLBIhwkCD+caw2FsifB0U6tXlles8Tycts='),
        BlockUtils.difficultyToCompact(1),
        1,
        0,
        104295,
        BlockHeader.Version.V1),
    new BlockInterlink([], new Hash(null)),
    new BlockBody(Address.fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAA='), [])
);
Block.GENESIS.HASH = Hash.fromBase64('ykmTb222PK189z6x6dpT3Ul607cGjzFzECR4WXO+m+Y=');

/* Genesis Accounts */
Accounts.GENESIS =
    'AAIP7R94Gl77Xrk4xvszHLBXdCzC9AAAAHKYqT3gAAh2jadJcsL852C50iDDRIdlFjsNAAAAcpipPeAA';
