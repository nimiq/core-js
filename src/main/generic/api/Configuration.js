/** @class Client.Configuration */
Client.Configuration = class Configuration {
    /**
     * @param {NetworkConfig} networkConfig
     * @param {Array.<Client.Feature>} features
     * @param {boolean} useVolatileStorage
     * @param {number} requiredBlockConfirmations
     * @package
     */
    constructor(networkConfig, features = [], useVolatileStorage = false, requiredBlockConfirmations = 10) {
        this._networkConfig = networkConfig;
        this._features = features;
        this._useVolatileStorage = useVolatileStorage;
        this._requiredBlockConfirmations = requiredBlockConfirmations;
    }

    get features() {
        return this._features;
    }

    get requiredBlockConfirmations() {
        return this._requiredBlockConfirmations;
    }

    get networkConfig() {
        return this._networkConfig;
    }

    /**
     * @returns {Promise.<BaseConsensus>}
     * @package
     */
    createConsensus() {
        if (this._useVolatileStorage) {
            if (this._features.includes(Client.Feature.MEMPOOL) || this._features.includes(Client.Feature.MINING)) {
                return Consensus.volatileLight(this._networkConfig);
            } else {
                return Consensus.volatilePico(this._networkConfig);
            }
        } else {
            if (this._features.includes(Client.Feature.LOCAL_HISTORY)) {
                return Consensus.full(this._networkConfig);
            } else if (this._features.includes(Client.Feature.MEMPOOL) || this._features.includes(Client.Feature.MINING)) {
                return Consensus.light(this._networkConfig);
            } else {
                return Consensus.pico(this._networkConfig);
            }
        }
    }

    /**
     * @param {Client.Feature} feature
     * @returns {boolean}
     */
    hasFeature(feature) {
        return this._features.includes(feature);
    }

    /**
     * @param {...Client.Feature} features
     * @throws
     */
    requireFeatures(...features) {
        for (const feature of features) {
            if (!this.hasFeature(feature)) {
                throw new Error(`Missing required client feature: ${feature}`);
            }
        }
    }

    /**
     * @returns {Client}
     */
    instantiateClient() {
        return new Client(this);
    }

    static builder() {
        return new Client.ConfigurationBuilder();
    }
};

/** @class Client.ConfigurationBuilder */
Client.ConfigurationBuilder = class ConfigurationBuilder {
    constructor() {
        this._features = new HashSet();
    }

    /**
     * Configure the client to be not reachable from the outside.
     * @returns {Client.ConfigurationBuilder}
     */
    dumb() {
        return this.protocol('dumb');
    }

    /**
     * Configure the client to be publicly reachable via WebRTC.
     * @returns {Client.ConfigurationBuilder}
     */
    rtc() {
        return this.protocol('rtc');
    }

    /**
     * Configure the client to provide a public, insecure WebSocket server.
     *
     * @param {string} host Publicly reachable hostname of this node
     * @param {number} [port=8443] Publicly reachable port
     * @returns {Client.ConfigurationBuilder}
     */
    ws(host, port = 8443) {
        return this.protocol('ws', host, port);
    }

    /**
     * Configure the client to provide a public, secure WebSocket server.
     *
     * @param {string} host Publicly reachable hostname of this node
     * @param {number} [port=8443] Publicly reachable port
     * @param {string} tlsKey Path to the tls private key
     * @param {string} tlsCert Path to the tls certificate
     * @returns {Client.ConfigurationBuilder}
     */
    wss(host, port = 8443, tlsKey, tlsCert) {
        return this.protocol('wss', host, port, tlsKey, tlsCert);
    }

    /**
     * Configure the protocol this client uses. Defaults to rtc for supported browsers and dumb otherwise.
     *
     * @param {'dumb'|'rtc'|'ws'|'wss'} protocol One of: dumb, rtc, ws, wss
     * @param {string} [host] Publicly reachable hostname of this node (required for ws and wss)
     * @param {number} [port=8443] Publicly reachable port (required for ws and wss)
     * @param {string} [tlsKey] Path to the tls private key (required for wss)
     * @param {string} [tlsCert] Path to the tls certificate (required for wss)
     * @returns {Client.ConfigurationBuilder}
     */
    protocol(protocol, host, port = 8443, tlsKey, tlsCert) {
        if (this._protocol) throw new Error('Protocol already configured');
        this._protocol = this._requiredSet(protocol, 'protocol', 'dumb', 'rtc', 'ws', 'wss');
        if (this._protocol === 'ws' || this._protocol === 'wss') {
            this._host = this._requiredType(host, 'host', 'string');
            this._port = this._requiredType(port, 'port', 'number');
        }
        if (this._protocol === 'wss') {
            this._tlsKey = this._requiredType(tlsKey, 'tlsKey', 'string');
            this._tlsCert = this._requiredType(tlsCert, 'tlsCert', 'string');
        }
        return this;
    }

    /**
     * Disable persistent storage. By default persistent storage will be used.
     * @param {boolean} [volatile]
     * @returns {Client.ConfigurationBuilder}
     */
    volatile(volatile = true) {
        if (typeof this._volatile !== 'undefined') throw new Error('volatile already set');
        this._volatile = this._requiredType(volatile, 'volatile', 'boolean');
        return this;
    }

    /**
     * Sets the number of blocks required to consider a transaction confirmed. Defaults to 10.
     * @param {number} confirmations
     * @returns {Client.ConfigurationBuilder}
     */
    blockConfirmations(confirmations) {
        if (typeof this._blockConfirmations !== 'undefined') throw new Error('blockConfirmations already set.');
        this._blockConfirmations = this._requiredType(confirmations, 'confirmations', 'number');
        return this;
    }

    /**
     * @param {...Client.Feature} feature
     * @returns {Client.ConfigurationBuilder}
     */
    feature(...feature) {
        this._features.addAll(feature);
        return this;
    }

    /**
     * @param {number} port
     * @param {string} header
     * @param {boolean} terminatesSsl
     * @param {...string} addresses
     * @returns {Client.ConfigurationBuilder}
     */
    reverseProxy(port, header, terminatesSsl, ...addresses) {
        if (this._protocol !== 'ws' && this._protocol !== 'wss') throw new Error('Protocol must be ws or wss for reverse proxy.');
        this._reverseProxy = {
            enabled: true,
            port: this._requiredType(port, 'port', 'number'),
            header: this._requiredType(header, 'header', 'string'),
            terminatesSsl,
            addresses: addresses
        };
        return this;
    }

    /**
     * @returns {Client.Configuration} The configuration object to create a client with.
     */
    build() {
        if (this._volatile && this._features.contains(Client.Feature.LOCAL_HISTORY)) {
            throw new Error('Local history is not available with volatile storage');
        }
        if (!this._protocol) {
            if (PlatformUtils.supportsWebRTC()) this._protocol = 'rtc';
            else this._protocol = 'dumb';
        }
        if (!this._reverseProxy) {
            this._reverseProxy = {enabled: false};
        }
        if (typeof this._blockConfirmations !== 'number') this._blockConfirmations = 10;
        let networkConfig;
        switch (this._protocol) {
            case 'dumb':
                networkConfig = new DumbNetworkConfig();
                break;
            case 'rtc':
                if (!PlatformUtils.supportsWebRTC()) throw new Error('WebRTC not supported on this platform');
                networkConfig = new RtcNetworkConfig();
                break;
            case 'ws':
                networkConfig = new WsNetworkConfig(this._host, this._port, this._reverseProxy);
                break;
            case 'wss':
                networkConfig = new WssNetworkConfig(this._host, this._port, this._tlsKey, this._tlsCert, this._reverseProxy);
                break;
        }
        return new Client.Configuration(networkConfig, this._features.values(), !!this._volatile, this._blockConfirmations);
    }

    /**
     * Instantiates a client from this configuration builder.
     * @returns {Client}
     */
    instantiateClient() {
        return this.build().instantiateClient();
    }

    _requiredType(val, name, type) {
        if (typeof val !== type) throw new Error(`Type of ${name} must be ${type}, but is ${typeof val}`);
        return val;
    }

    _requiredSet(val, name, ...values) {
        if (!val) throw new Error(`${name} is required`);
        if (!values.includes(val)) throw new Error(`${name} must be one of: ${values.join(', ')}`);
        return val;
    }
};

/** @enum Client.Feature */
Client.Feature = {
    /**
     * Allow the client to generate blocks and attach new blocks to the chain. This is required to use the
     * {@link Client#getBlockTemplate} and {@link Client#submitBlock} functions.
     *
     * This features is <b>not</b> required for pool assisted mining.
     */
    MINING: 'MINING',
    /**
     * Store the history of all blocks and transactions locally. This is required to have transaction receipts
     * become authenticated data.
     */
    LOCAL_HISTORY: 'LOCAL_HISTORY',
    /**
     * Have a full local mempool. This is required to build blocks using the {@link Client#getBlockTemplate} and to
     * access the {@link Client#mempool}.
     */
    MEMPOOL: 'MEMPOOL',
    /**
     * Make the client not connect to the network actively, but only accept incoming connections.
     * Useful only if this node is registered as a seed node for the rest of the network.
     */
    PASSIVE: 'PASSIVE',
};
