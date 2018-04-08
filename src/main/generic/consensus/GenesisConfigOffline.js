class GenesisConfig {
    static main() {
        GenesisConfig.init(GenesisConfig.CONFIGS['main']);
    }

    static test() {
        GenesisConfig.init(GenesisConfig.CONFIGS['test']);
    }

    static dev() {
        GenesisConfig.init(GenesisConfig.CONFIGS['dev']);
    }

    static bounty() {
        GenesisConfig.init(GenesisConfig.CONFIGS['bounty']);
    }

    /**
     * @param {{NETWORK_ID:number}} config
     */
    static init(config) {
        if (GenesisConfig._config) throw new Error('GenesisConfig already initialized');
        if (!config.NETWORK_ID) throw new Error('Config is missing network id');

        GenesisConfig._config = config;
    }

    /**
     * @type {number}
     */
    static get NETWORK_ID() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.NETWORK_ID;
    }
}
Class.register(GenesisConfig);

GenesisConfig.CONFIGS = {
    // TODO 'main': { }
    'test': {
        NETWORK_ID: 1,
        NETWORK_NAME: 'test'
    },

    'dev': {
        NETWORK_ID: 2,
        NETWORK_NAME: 'dev'
    },

    'bounty': {
        NETWORK_ID: 3,
        NETWORK_NAME: 'bounty'
    }
};
// TODO
GenesisConfig.CONFIGS['main'] = GenesisConfig.CONFIGS['test'];
