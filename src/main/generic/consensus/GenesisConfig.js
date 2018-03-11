class GenesisConfig {
    static dev() {
        GenesisConfig.init(GenesisConfig.CONFIGS['dev']);
    }

    static bounty() {
        GenesisConfig.init(GenesisConfig.CONFIGS['bounty']);
    }

    /**
     * @param {{NETWORK_ID:number,NETWORK_NAME:string,GENESIS_BLOCK:Block,GENESIS_ACCOUNTS:string,SEED_PEERS:Array.<PeerAddress>}} config
     */
    static init(config) {
        if (GenesisConfig._CONFIG) throw new Error('GenesisConfig already initialized');
        if (!config.NETWORK_ID) throw new Error('Config is missing network id');
        if (!config.NETWORK_NAME) throw new Error('Config is missing database prefix');
        if (!config.GENESIS_BLOCK) throw new Error('Config is missing genesis block');
        if (!config.GENESIS_ACCOUNTS) throw new Error('Config is missing genesis accounts');
        if (!config.SEED_PEERS) throw new Error('Config is missing seed peers');

        GenesisConfig._CONFIG = config;
    }

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
    static get NETWORK_NAME() {
        if (!GenesisConfig._CONFIG) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._CONFIG.NETWORK_NAME;
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
Class.register(GenesisConfig);

GenesisConfig.CONFIGS = {
    // TODO 'main': { }
    // TODO 'test': { }

    'dev': {
        NETWORK_ID: 2,
        NETWORK_NAME: 'dev',
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
    },

    'bounty': {
        NETWORK_ID: 3,
        NETWORK_NAME: 'bounty',
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
            WsPeerAddress.seed('bug-bounty1.nimiq-network.com', 8080, '7e825872ee12a71bda50cba9f230c760c84ee50eef0a3e435467e8d5307c0b4e'),
            WsPeerAddress.seed('bug-bounty2.nimiq-network.com', 8080, 'ea876175c8b693c0db38b7c17d66e9c510020fceb4634f04e281af30438f8787'),
            WsPeerAddress.seed('bug-bounty3.nimiq-network.com', 8080, '5c0d5d801e85ebd42f25a45b2cb7f3b39b9ce14002d4662f5ed0cd79ce25165a')
        ]
    }
};
