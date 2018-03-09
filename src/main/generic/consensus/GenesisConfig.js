class GenesisConfig {
    constructor(networkId, databasePrefix, genesisBlock, genesisHash, genesisAccounts, seedPeers) {
        this._networkId = networkId;
        this._databasePrefix = databasePrefix;
        this._genesisBlock = genesisBlock;
        this._genesisHash = genesisHash;
        this._genesisAccounts = genesisAccounts;
        this._seedPeers = seedPeers;
    }

    get NETWORK_ID() {
        return this._networkId;
    }

    get DATABASE_PREFIX() {
        return this._databasePrefix;
    }

    get GENESIS_BLOCK() {
        return this._genesisBlock;
    }

    get GENESIS_HASH() {
        return this._genesisHash;
    }

    get GENESIS_ACCOUNTS() {
        return this._genesisAccounts;
    }

    get SEED_PEERS() {
        return this._seedPeers;
    }

    static devnet() {
        GenesisConfig.CURRENT_CONFIG = GenesisConfig.CONFIGS[2];
        return GenesisConfig.CURRENT_CONFIG;
    }

    withSeedPeers(seedPeers) {
        return new GenesisConfig(this._networkId, this._databasePrefix, this._genesisBlock, this._genesisHash, this._genesisAccounts, seedPeers);
    }
}
GenesisConfig.CONFIGS = {
    2: new GenesisConfig(2, 'devnet-',
        new Block(
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
        ),
        Hash.fromBase64('ykmTb222PK189z6x6dpT3Ul607cGjzFzECR4WXO+m+Y='),
        'AAIP7R94Gl77Xrk4xvszHLBXdCzC9AAAAHKYqT3gAAh2jadJcsL852C50iDDRIdlFjsNAAAAcpipPeAA',
        [
            WsPeerAddress.seed('dev.nimiq-network.com', 8080, 'e65e39616662f2c16d62dc08915e5a1d104619db8c2b9cf9b389f96c8dce9837')
        ]
    )
};
GenesisConfig.CURRENT_CONFIG = GenesisConfig.CONFIGS[2];
Class.register(GenesisConfig);
