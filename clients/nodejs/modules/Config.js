const fs = require('fs');
const JSON5 = require('json5');
const merge = require('lodash.merge');
const Log = require('../../../dist/node.js').Log;
const TAG = 'Config';

/**
 * @typedef {object} Config
 * @property {string} host
 * @property {{cert: string, key: string}} tls
 * @property {number} port
 * @property {string} protocol
 * @property {boolean} dumb
 * @property {string} type
 * @property {boolean} volatile
 * @property {string} network
 * @property {boolean} passive
 * @property {number} statistics
 * @property {{enabled: boolean, threads: string|number, throttleAfter: number, throttleWait: number, extraData: string}} miner
 * @property {{enabled: boolean, host: string, port: number, mode: string, deviceData: object}} poolMining
 * @property {{enabled: boolean, port: number, corsdomain: string|Array.<string>, allowip: string|Array.<string>, methods: Array.<string>, username: string, password: string}} rpcServer
 * @property {{enabled: boolean, port: number}} uiServer
 * @property {{enabled: boolean, port: number, password: string}} metricsServer
 * @property {{seed: string, address: string}} wallet
 * @property {{enabled: boolean, port: number, address: string, addresses: Array.<string>, header: string, terminatesSsl: boolean}} reverseProxy
 * @property {{level: string, tags: object}} log
 * @property {Array.<{host: string, port: number, publicKey: string, protocol: string}>} seedPeers
 * @property {object} constantOverrides
 */

const DEFAULT_CONFIG = /** @type {Config} */ {
    host: null,
    tls: {
        cert: null,
        key: null
    },
    port: 8443,
    protocol: 'wss',
    dumb: false, // deprecated
    type: 'full',
    volatile: false,
    network: 'main',
    passive: false,
    statistics: 0,
    miner: {
        enabled: false,
        threads: 'auto',
        throttleAfter: Infinity,
        throttleWait: 100,
        extraData: ''
    },
    poolMining: {
        enabled: false,
        host: null,
        port: -1,
        mode: 'smart',
        deviceData: null
    },
    rpcServer: {
        enabled: false,
        port: 8648,
        corsdomain: null,
        allowip: null,
        methods: null,
        username: null,
        password: null
    },
    uiServer: {
        enabled: false,
        port: 8650
    },
    metricsServer: {
        enabled: false,
        port: 8649,
        password: null
    },
    wallet: {
        seed: null,
        address: null
    },
    reverseProxy: {
        enabled: false,
        port: 8444,
        address: '::ffff:127.0.0.1', // deprecated
        addresses: [],
        header: 'x-forwarded-for',
        terminatesSsl: false
    },
    log: {
        level: 'info',
        tags: {}
    },
    seedPeers: [],
    constantOverrides: {}
};

const CONFIG_TYPES = {
    host: 'string',
    tls: {
        type: 'object', sub: {
            cert: 'string',
            key: 'string'
        }
    },
    port: 'number',
    protocol: {type: 'string', values: ['wss', 'ws', 'dumb']},
    dumb: 'boolean', // deprecated
    type: {type: 'string', values: ['full', 'light', 'nano', 'pico']},
    volatile: 'boolean',
    network: {type: 'string', values: ['main', 'test', 'dev']},
    passive: 'boolean',
    statistics: 'number',
    miner: {
        type: 'object', sub: {
            enabled: 'boolean',
            threads: {type: 'mixed', types: ['number', {type: 'string', values: ['auto']}]},
            throttleAfter: 'number',
            throttleWait: 'number',
            extraData: 'string'
        }
    },
    poolMining: {
        type: 'object', sub: {
            enabled: 'boolean',
            host: 'string',
            port: 'number',
            mode: {type: 'string', values: ['smart', 'nano']},
            deviceData: 'object'
        }
    },
    rpcServer: {
        type: 'object', sub: {
            enabled: 'boolean',
            port: 'number',
            corsdomain: {type: 'mixed', types: ['string', {type: 'array', inner: 'string'}]},
            allowip: {type: 'mixed', types: ['string', {type: 'array', inner: 'string'}]},
            methods: {type: 'array', inner: 'string'},
            username: 'string',
            password: 'string'
        }
    },
    uiServer: {
        type: 'object', sub: {
            enabled: 'boolean',
            port: 'number'
        }
    },
    metricsServer: {
        type: 'object', sub: {
            enabled: 'boolean',
            port: 'number',
            password: 'string'
        }
    },
    wallet: {
        type: 'object', sub: {
            seed: 'string',
            address: 'string'
        }
    },
    reverseProxy: {
        type: 'object', sub: {
            enabled: 'boolean',
            port: 'number',
            address: 'string', // deprecated
            addresses: {type: 'array', inner: 'string'},
            header: 'string',
            terminatesSsl: 'boolean'
        }
    },
    log: {
        type: 'object', sub: {
            level: {type: 'string', values: ['trace', 'verbose', 'debug', 'info', 'warning', 'error', 'assert']},
            tags: 'object'
        }
    },
    seedPeers: {
        type: 'array', inner: {
            type: 'object', sub: {
                host: 'string',
                port: 'number',
                publicKey: 'string',
                protocol: {type: 'string', values: ['wss', 'ws']}
            }
        }
    },
    constantOverrides: 'object'
};

function validateItemType(config, key, type, error = true) {
    let valid = true;
    if (typeof type === 'string') {
        if (type === 'boolean') {
            if (config[key] === 'yes' || config[key] === 1) config[key] = true;
            if (config[key] === 'no' || config[key] === 0) config[key] = false;
        }
        if (type === 'number' && typeof config[key] === 'string') {
            if (!isNaN(parseInt(config[key]))) {
                Log.i(TAG, `Configuration option '${key}' should be of type 'number', but is of type 'string', will parse it.`);
                config[key] = parseInt(config[key]);
            }
        }
        if (type === 'string' && typeof config[key] === 'number') {
            Log.i(TAG, `Configuration option '${key}' should be of type 'string', but is of type 'number', will convert it.`);
            config[key] = config[key].toString();
        }
        if (typeof config[key] !== type) {
            if (error) Log.w(TAG, `Configuration option '${key}' is of type '${typeof config[key]}', but '${type}' is required`);
            valid = false;
        }
    } else if (typeof type === 'object') {
        if (['string', 'number', 'object'].includes(type.type)) {
            if (!validateItemType(config, key, type.type)) {
                valid = false;
            }
        }
        if (type.type === 'array') {
            if (!Array.isArray(config[key])) {
                if (error) Log.w(TAG, `Configuration option '${key}' should be an array.`);
                valid = false;
            } else if (type.inner) {
                for (let i = 0; i < config[key].length; i++) {
                    if (!validateItemType(config[key], i, type.inner, false)) {
                        if (error) Log.w(TAG, `Element ${i} of configuration option '${key}' is invalid.`);
                        valid = false;
                    }
                }
            }
        }
        if (Array.isArray(type.values)) {
            if (!type.values.includes(config[key])) {
                if (error) Log.w(TAG, `Configuration option '${key}' is '${config[key]}', but must be one of '${type.values.slice(0, type.values.length - 1).join('\', \'')}' or '${type.values[type.values.length - 1]}'.`);
                valid = false;
            }
        }
        if (typeof config[key] === 'object' && type.type === 'object' && typeof type.sub === 'object') {
            if (!validateObjectType(config[key], type.sub, error)) {
                valid = false;
            }
        }
        if (type.type === 'mixed' && Array.isArray(type.types)) {
            let subvalid = false;
            for (const subtype of type.types) {
                if (validateItemType(config, key, subtype, false)) {
                    subvalid = true;
                    break;
                }
            }
            if (!subvalid) {
                if (error) Log.w(TAG, `Configuration option '${key}' is invalid`);
                valid = false;
            }
        }
    }
    return valid;
}

function validateObjectType(config, types = CONFIG_TYPES, error = true) {
    let valid = true;
    for (const key in types) {
        if (!(key in config) || config[key] === undefined || config[key] === null) {
            if (typeof types[key] === 'object' && types[key].required) {
                if (error) Log.w(TAG, `Required configuration option '${key}' is missing`);
                valid = false;
            }
            continue;
        }
        if (!validateItemType(config, key, types[key], error)) {
            valid = false;
        }
    }
    return valid;
}

if (!validateObjectType(DEFAULT_CONFIG)) {
    throw new Error('Default config is invalid according to type specification.');
}

/**
 * @param {string} file
 * @param {object} oldConfig
 * @returns {Config|boolean}
 */
function readFromFile(file, oldConfig = merge({}, DEFAULT_CONFIG)) {
    try {
        let config = JSON5.parse(fs.readFileSync(file));
        if (!validateObjectType(config)) {
            Log.e(TAG, `Configuration file ${file} is invalid.`);
            return false;
        } else {
            config = merge(oldConfig, config);
            if (config.dumb) {
                Log.w('The \'dumb\' flag is deprecated, use \'protocol: "dumb"\' instead.');
                config.protocol = 'dumb';
            }
            if (config.reverseProxy.address && config.reverseProxy.addresses.length === 0) {
                if (config.reverseProxy.address !== DEFAULT_CONFIG.reverseProxy.address) {
                    Log.w('The \'address\' option for \'reverseProxy\' is deprecated, use \'addresses\' instead.');
                }
                config.reverseProxy.addresses.push(config.reverseProxy.address);
            }
            return config;
        }
    } catch (e) {
        Log.e(TAG, `Failed to read file ${file}: ${e.message}`);
        return false;
    }
}

/**
 * @param {object} argv
 * @param {object} config
 * @returns {Config|boolean}
 */
function readFromArgs(argv, config = merge({}, DEFAULT_CONFIG)) {
    if (argv.config) {
        if (!readFromFile(argv.config, config)) {
            return false;
        }
    }
    if (typeof argv.host === 'string') config.host = argv.host;
    if (typeof argv.port === 'number') config.port = argv.port;
    if (typeof argv.port === 'string') config.port = parseInt(argv.port);
    if (typeof argv.cert === 'string') config.tls.cert = argv.cert;
    if (typeof argv.key === 'string') config.tls.key = argv.key;
    if (typeof argv.protocol === 'string') config.protocol = argv.protocol;
    if (argv.dumb) {
        Log.w('The \'--dumb\' flag is deprecated, use \'--protocol=dumb\' instead.');
        config.protocol = 'dumb';
    }
    if (typeof argv.type === 'string') config.type = argv.type;
    if (argv.volatile) config.volatile = argv.volatile;
    if (typeof argv.network === 'string') config.network = argv.network;
    if (argv.passive) config.passive = true;
    if (argv.statistics) {
        config.statistics = 10;
        if (typeof argv.statistics === 'number') config.statistics = argv.statistics;
        if (typeof argv.statistics === 'string') config.statistics = parseInt(argv.statistics);
    }
    if (argv.miner) {
        config.miner.enabled = true;
        if (typeof argv.miner === 'number') config.miner.threads = argv.miner;
        if (typeof argv.miner === 'string') config.miner.threads = parseInt(argv.miner);
        if (typeof argv['extra-data'] === 'string') config.miner.extraData = argv['extra-data'];
    }
    if (argv.pool) {
        config.poolMining.enabled = true;
        if (typeof argv.pool === 'string') {
            const split = argv.pool.split(':', 2);
            config.poolMining.host = split[0];
            config.poolMining.port = parseInt(split[1]);
        }
    }
    if (argv['device-data'] && config.poolMining.enabled) {
        try {
            config.poolMining.deviceData = JSON.parse(argv['device-data']);
        } catch (e) {
            return false;
        }
    }
    if (argv.rpc) {
        config.rpcServer.enabled = true;
        if (typeof argv.rpc === 'number') config.rpcServer.port = argv.rpc;
        if (typeof argv.rpc === 'string') config.rpcServer.port = parseInt(argv.rpc);
    }
    if (argv.ui) {
        config.uiServer.enabled = true;
        if (typeof argv.ui === 'number') config.uiServer.port = argv.ui;
        if (typeof argv.ui === 'string') config.uiServer.port = parseInt(argv.ui);
    }
    if (argv.metrics) {
        config.metricsServer.enabled = true;
        if (typeof argv.metrics === 'number') config.metricsServer.port = argv.metrics;
        if (typeof argv.metrics === 'string') {
            const split = argv.metrics.split(':', 2);
            config.metricsServer.port = parseInt(split[0]);
            if (split.length === 2) config.metricsServer.password = split[1];
        }
    }
    if (typeof argv['wallet-seed'] === 'string') config.wallet.seed = argv['wallet-seed'];
    if (typeof argv['wallet-address'] === 'string') config.wallet.address = argv['wallet-address'];
    if (argv['reverse-proxy']) {
        config.reverseProxy.enabled = true;
        if (typeof argv['reverse-proxy'] === 'number') config.reverseProxy.port = argv['reverse-proxy'];
        if (typeof argv['reverse-proxy'] === 'string') {
            const split = argv['reverse-proxy'].split(',', 2);
            config.reverseProxy.port = parseInt(split[0]);
            if (split.length === 2) config.reverseProxy.addresses = [split[1]];
        }
    }
    if (argv.log || argv.verbose) {
        config.log.level = 'verbose';
        if (typeof argv.log === 'string') config.log.level = argv.log;
        if (argv.verbose) {
            Log.w('The \'--verbose\' flag is deprecated, use \'--log\' instead.');
        }
    }

    if (!validateObjectType(config)) {
        return false;
    }

    return config;
}

module.exports = readFromArgs;
module.exports.readFromFile = readFromFile;
