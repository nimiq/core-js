class Services {
    /**
     * @constructor
     * @param {number} [provided=Services.NONE] Bitmap of services that can be provided by this node
     * @param {number} [accepted=Services.NONE] Bitmap of services that can be accepted by this node
     */
    constructor(provided = Services.NONE, accepted = Services.NONE) {
        this._provided = provided;
        this._accepted = accepted;
    }

    /**
     * @type {number}
     */
    get provided() {
        return this._provided;
    }

    /**
     * @type {number}
     */
    get accepted() {
        return this._accepted;
    }

    /**
     * @param {number} services Bitmap of services that can be provided
     */
    set provided(services) {
        this._provided = services;
    }

    /**
     * @param {number} services Bitmap of services that can be accepted
     */
    set accepted(services) {
        this._accepted = services;
    }

    /**
     * @param {number} services Bitmap of the services to check
     * @returns {boolean}
     * @deprecated
     */
    static isFullNode(services) {
        return (services & Services.FLAG_FULL) !== 0;
    }

    /**
     * @param {number} services Bitmap of the services to check
     * @returns {boolean}
     * @deprecated
     */
    static isLightNode(services) {
        return (services & Services.FLAG_LIGHT) !== 0;
    }

    /**
     * @param {number} services Bitmap of the services to check
     * @returns {boolean}
     * @deprecated
     */
    static isNanoNode(services) {
        return services === Services.FLAG_NANO;
    }

    /**
     * @param {number} flags
     * @param {...number} services
     */
    static providesServices(flags, ...services) {
        flags = Services.legacyProvideToCurrent(flags);
        const all = services.reduce((a, b) => a | b) & Services.ALL_CURRENT;
        return (flags & all) === all;
    }

    static legacyProvideToCurrent(flags) {
        if (flags === Services.FLAG_NANO) flags = Services.PROVIDES_NANO;
        if (flags === Services.FLAG_LIGHT) flags = Services.PROVIDES_LIGHT;
        if (flags === Services.FLAG_FULL) flags = Services.PROVIDES_FULL;
        return flags;
    }

    /**
     * @param {number} flags
     * @returns {Array.<string>}
     */
    static toNameArray(flags) {
        const res = [];
        let i = 1;
        do {
            if ((flags & i) === i && Services.NAMES[i]) res.push(Services.NAMES[i]);
            i <<= 1;
        } while (i < Services.ALL_CURRENT);
        return res;
    }
}

Services.NONE    = 0;

/** @deprecated */
Services.FLAG_NANO  = 1 << 0;
/** @deprecated */
Services.FLAG_LIGHT = 1 << 1;
/** @deprecated */
Services.FLAG_FULL  = 1 << 2;
/** @deprecated */
Services.ALL_LEGACY = (1 << 3) - 1;

/**
 * The node provides at least the latest {@link Policy.NUM_BLOCKS_VERIFICATION} as full blocks.
 */
Services.FULL_BLOCKS       = 1 << 3;
/**
 * The node provides the full block history.
 *
 * If {@link Services.FULL_BLOCKS} is set, these blocks are provided as full blocks.
 */
Services.BLOCK_HISTORY     = 1 << 4;
/**
 * The node provides a proof that a certain block is included in the current chain.
 *
 * If {@link Services.FULL_BLOCKS} is set, these blocks may be requested as full blocks.
 *
 * However, if {@link Services.BLOCK_HISTORY} is not set, this service is only provided for the latest
 * {@link Policy.NUM_BLOCKS_VERIFICATION} blocks.
 */
Services.BLOCK_PROOF       = 1 << 5;
/**
 * The node provides a chain proof for the tip of the current main chain.
 */
Services.CHAIN_PROOF       = 1 << 6;
/**
 * The node provides inclusion and exclusion proofs for accounts that are necessary to verify active accounts as well as
 * accounts in all transactions it provided from its mempool.
 *
 * However, if {@link Services.ACCOUNTS_CHUNKS} is not set, the node may occasionally not provide a proof if it
 * decided to prune the account from local storage.
 */
Services.ACCOUNTS_PROOF    = 1 << 7;
/**
 * The node provides the full accounts tree in form of chunks.
 * This implies that the client stores the full accounts tree.
 */
Services.ACCOUNTS_CHUNKS   = 1 << 8;
/**
 * The node tries to stay on sync with the network wide mempool and will provide access to it.
 *
 * Nodes that do not have this flag set may occasionally announce transactions from their mempool and/or reply to
 * mempool requests to announce locally crafted transactions.
 */
Services.MEMPOOL           = 1 << 9;
/**
 * The node provides an index of transactions allowing it to find historic transactions by address or by hash.
 *
 * Nodes that have this flag set may prune any part of their transaction index at their discretion, they do not claim
 * completeness of their results either.
 */
Services.TRANSACTION_INDEX = 1 << 10;
/**
 * The node provides proofs for details from the block body, i.e. transaction proofs.
 *
 * However, if {@link Services.BLOCK_HISTORY} is not set, this service is only provided for the latest
 * {@link Policy.NUM_BLOCKS_VERIFICATION} blocks.
 */
Services.BODY_PROOF        = 1 << 11;
Services.ALL_CURRENT       = (1 << 12) - 1 - Services.ALL_LEGACY;

Services.NAMES = {};
Services.NAMES[Services.FULL_BLOCKS] = 'FULL_BLOCKS';
Services.NAMES[Services.BLOCK_HISTORY] = 'BLOCK_HISTORY';
Services.NAMES[Services.BLOCK_PROOF] = 'BLOCK_PROOF';
Services.NAMES[Services.CHAIN_PROOF] = 'CHAIN_PROOF';
Services.NAMES[Services.ACCOUNTS_PROOF] = 'ACCOUNTS_PROOF';
Services.NAMES[Services.ACCOUNTS_CHUNKS] = 'ACCOUNTS_CHUNKS';
Services.NAMES[Services.MEMPOOL] = 'MEMPOOL';
Services.NAMES[Services.TRANSACTION_INDEX] = 'TRANSACTION_INDEX';
Services.NAMES[Services.BODY_PROOF] = 'BODY_PROOF';

Services.PROVIDES_FULL =        Services.FLAG_FULL | Services.ALL_CURRENT;
Services.PROVIDES_LIGHT =       Services.FLAG_LIGHT | Services.FULL_BLOCKS | Services.BLOCK_PROOF |
                                Services.CHAIN_PROOF | Services.ACCOUNTS_PROOF | Services.ACCOUNTS_CHUNKS |
                                Services.MEMPOOL | Services.BODY_PROOF;
Services.PROVIDES_NANO =        Services.FLAG_NANO | Services.CHAIN_PROOF;
Services.PROVIDES_PICO =        Services.NONE;

// This should be interpreted as accepting a node with (FLAG_FULL OR (FULL_BLOCKS AND BLOCK_HISTORY)), same for the other "ACCEPTS_*"
Services.ACCEPTS_FULL =         Services.FLAG_FULL | Services.FULL_BLOCKS | Services.BLOCK_HISTORY;
Services.ACCEPTS_LIGHT =        Services.FLAG_LIGHT | Services.FLAG_FULL | Services.FULL_BLOCKS | Services.CHAIN_PROOF |
                                Services.ACCOUNTS_CHUNKS;
Services.ACCEPTS_NANO =         Services.FLAG_NANO | Services.FLAG_LIGHT | Services.FLAG_FULL | Services.CHAIN_PROOF;
Services.ACCEPTS_PICO =         Services.FLAG_NANO | Services.FLAG_LIGHT | Services.FLAG_FULL;

Services.ACCEPTS_SPV =          Services.BLOCK_PROOF | Services.ACCOUNTS_PROOF | Services.MEMPOOL |
                                Services.TRANSACTION_INDEX | Services.BODY_PROOF;

Class.register(Services);
