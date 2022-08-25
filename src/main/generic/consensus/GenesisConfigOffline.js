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

    /**
     * @param {{NETWORK_ID:number,NETWORK_NAME:string}} config
     */
    static init(config) {
        if (GenesisConfig._config) throw new Error('GenesisConfig already initialized');
        if (!config.NETWORK_ID) throw new Error('Config is missing network id');
        if (!config.NETWORK_NAME) throw new Error('Config is missing network name');

        GenesisConfig._config = config;
    }

    /**
     * @type {number}
     */
    static get NETWORK_ID() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.NETWORK_ID;
    }

    /**
     * @type {string}
     */
    static get NETWORK_NAME() {
        if (!GenesisConfig._config) throw new Error('GenesisConfig not initialized');
        return GenesisConfig._config.NETWORK_NAME;
    }

    /**
     * @param {number} networkId
     * @return {string}
     */
    static networkIdToNetworkName(networkId) {
        for (const key of Object.keys(GenesisConfig.CONFIGS)) {
            const config = GenesisConfig.CONFIGS[key];
            if (networkId === config.NETWORK_ID) {
                return config.NETWORK_NAME;
            }
        }
        throw new Error(`Unable to find networkName for networkId ${networkId}`);
    }

    /**
     * @param {number|string} networkId
     * @return {number}
     */
    static networkIdFromAny(networkId) {
        if (typeof networkId === 'number') return networkId;
        if (GenesisConfig.CONFIGS[networkId]) {
            return GenesisConfig.CONFIGS[networkId].NETWORK_ID;
        }
        throw new Error(`Unable to find networkId for ${networkId}`);
    }
}
Class.register(GenesisConfig);

GenesisConfig.CONFIGS = {
    'main': {
        NETWORK_ID: 42,
        NETWORK_NAME: 'main'
    },

    'test': {
        NETWORK_ID: 1,
        NETWORK_NAME: 'test'
    },

    'dev': {
        NETWORK_ID: 2,
        NETWORK_NAME: 'dev'
    }
};
