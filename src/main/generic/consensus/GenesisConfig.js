class GenesisConfig {
    /**
     * @param {{NETWORK_ID:number,DATABASE_PREFIX:string,GENESIS_BLOCK:Block,GENESIS_ACCOUNTS:string,SEED_PEERS:Array.<PeerAddress>}} networkId
     */
    static init(config) {
        if (GenesisConfig._CONFIG) throw new Error('Already initialized');
        if (!config.NETWORK_ID) throw new Error('Config is missing network id');
        if (!config.DATABASE_PREFIX) throw new Error('Config is missing database prefix');
        if (!config.GENESIS_BLOCK) throw new Error('Config is missing genesis block');
        if (!config.GENESIS_ACCOUNTS) throw new Error('Config is missing genesis accounts');
        if (!config.SEED_PEERS) throw new Error('Config is missing seed peers');

        // Copy over config.
        GenesisConfig._CONFIG = config;
    }

    static devnet() {
        GenesisConfig.init(GenesisConfig.CONFIGS[2]);
    }

    /*
     * Static getters.
     */

    /**
     * @type {number}
     */
    static get NETWORK_ID() {
        if (!GenesisConfig._CONFIG) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._CONFIG.NETWORK_ID;
    }

    /**
     * @type {string}
     */
    static get DATABASE_PREFIX() {
        if (!GenesisConfig._CONFIG) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._CONFIG.DATABASE_PREFIX;
    }

    /**
     * @type {Block}
     */
    static get GENESIS_BLOCK() {
        if (!GenesisConfig._CONFIG) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._CONFIG.GENESIS_BLOCK;
    }

    /**
     * @type {Hash}
     */
    static get GENESIS_HASH() {
        if (!GenesisConfig._CONFIG) throw new Error('GenesisConfig not initialized');
        if (!GenesisConfig._CONFIG.GENESIS_HASH) {
            GenesisConfig._CONFIG.GENESIS_HASH = GenesisConfig._CONFIG.GENESIS_BLOCK.hash();
        }
        return GenesisConfig._CONFIG.GENESIS_HASH;
    }

    /**
     * @type {string}
     */
    static get GENESIS_ACCOUNTS() {
        if (!GenesisConfig._CONFIG) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._CONFIG.GENESIS_ACCOUNTS;
    }

    /**
     * @type {Array.<PeerAddress>}
     */
    static get SEED_PEERS() {
        if (!GenesisConfig._CONFIG) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._CONFIG.SEED_PEERS;
    }
}
GenesisConfig.CONFIGS = {
    2: {
        NETWORK_ID: 2,
        DATABASE_PREFIX: 'devnet-',
        GENESIS_BLOCK: new Block(
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
        GENESIS_ACCOUNTS: 'AAIP7R94Gl77Xrk4xvszHLBXdCzC9AAAAHKYqT3gAAh2jadJcsL852C50iDDRIdlFjsNAAAAcpipPeAA',
        SEED_PEERS: [
            WsPeerAddress.seed('dev.nimiq-network.com', 8080, 'e65e39616662f2c16d62dc08915e5a1d104619db8c2b9cf9b389f96c8dce9837')
        ]
    }
};
Class.register(GenesisConfig);
