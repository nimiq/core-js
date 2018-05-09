class Policy {
    /**
     * Convert Nimiq decimal to Number of Satoshis.
     * @param {number} coins Nimiq count in decimal
     * @return {number} Number of Satoshis
     */
    static coinsToSatoshis(coins) {
        return Math.round(coins * Policy.SATOSHIS_PER_COIN);
    }

    /**
     * Convert Number of Satoshis to Nimiq decimal.
     * @param {number} satoshis Number of Satoshis.
     * @return {number} Nimiq count in decimal.
     */
    static satoshisToCoins(satoshis) {
        return satoshis / Policy.SATOSHIS_PER_COIN;
    }

    /**
     * Circulating supply after block.
     * @param {number} blockHeight
     * @return {number}
     */
    static supplyAfter(blockHeight) {
        // Calculate last entry in supply cache that is below blockHeight.
        let startHeight = Math.floor(blockHeight / Policy._supplyCacheInterval) * Policy._supplyCacheInterval;
        startHeight = Math.max(0, Math.min(startHeight, Policy._supplyCacheMax));

        // Calculate respective block for the last entry of the cache and the targeted height.
        const startI = startHeight / Policy._supplyCacheInterval;
        const endI = Math.floor(blockHeight / Policy._supplyCacheInterval);

        // The starting supply is the initial supply at the beginning and a cached value afterwards.
        let supply = startHeight === 0 ? Policy.INITIAL_SUPPLY : Policy._supplyCache.get(startHeight);
        // Use and update cache.
        for (let i = startI; i < endI; ++i) {
            startHeight = i * Policy._supplyCacheInterval;
            // Since the cache stores the supply *before* a certain block, subtract one.
            const endHeight = (i + 1) * Policy._supplyCacheInterval - 1;
            supply = Policy._supplyAfter(supply, endHeight, startHeight);
            // Don't forget to add one again.
            Policy._supplyCache.set(endHeight + 1, supply);
            Policy._supplyCacheMax = endHeight + 1;
        }

        // Calculate remaining supply (this also adds the block reward for endI*interval).
        return Policy._supplyAfter(supply, blockHeight, endI * Policy._supplyCacheInterval);
    }

    /**
     * Circulating supply after block.
     * @param {number} initialSupply
     * @param {number} blockHeight
     * @param {number} [startHeight]
     * @return {number}
     */
    static _supplyAfter(initialSupply, blockHeight, startHeight=0) {
        let supply = initialSupply;
        for (let i = startHeight; i <= blockHeight; ++i) {
            supply += Policy._blockRewardAt(supply, i);
        }
        return supply;
    }

    /**
     * Miner reward per block.
     * @param {number} blockHeight
     * @return {number}
     */
    static blockRewardAt(blockHeight) {
        const currentSupply = Policy.supplyAfter(blockHeight - 1);
        return Policy._blockRewardAt(currentSupply, blockHeight);
    }

    /**
     * Miner reward per block.
     * @param {number} currentSupply
     * @param {number} blockHeight
     * @return {number}
     */
    static _blockRewardAt(currentSupply, blockHeight) {
        if (blockHeight <= 0) return 0;
        const remaining = Policy.TOTAL_SUPPLY - currentSupply;
        if (blockHeight >= Policy.EMISSION_TAIL_START && remaining >= Policy.EMISSION_TAIL_REWARD) {
            return Policy.EMISSION_TAIL_REWARD;
        }
        const remainder = remaining % Policy.EMISSION_SPEED;
        return (remaining - remainder) / Policy.EMISSION_SPEED;
    }
}

/**
 * Targeted block time in seconds.
 * @type {number}
 * @constant
 */
Policy.BLOCK_TIME = 60;

/**
 * Maximum block size in bytes.
 * @type {number}
 * @constant
 */
Policy.BLOCK_SIZE_MAX = 1e5; // 100 kb

/**
 * The highest (easiest) block PoW target.
 * @type {BigNumber}
 * @constant
 */
Policy.BLOCK_TARGET_MAX = new BigNumber(2).pow(240);

/**
 * Number of blocks we take into account to calculate next difficulty.
 * @type {number}
 * @constant
 */
Policy.DIFFICULTY_BLOCK_WINDOW = 120;

/**
 * Limits the rate at which the difficulty is adjusted min/max.
 * @type {number}
 * @constant
 */
Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR = 2;

/**
 * Number of blocks a transaction is valid.
 * @type {number}
 * @constant
 */
Policy.TRANSACTION_VALIDITY_WINDOW = 120;


/* Supply & Emission Parameters */

/**
 * Number of Satoshis per Nimiq.
 * @type {number}
 * @constant
 */
Policy.SATOSHIS_PER_COIN = 1e5;

/**
 * Targeted total supply in satoshis.
 * @type {number}
 * @constant
 */
Policy.TOTAL_SUPPLY = 21e14;

/**
 * Initial supply before genesis block in satoshis.
 * FIXME: Change for main net.
 * @type {number}
 * @constant
 */
Policy.INITIAL_SUPPLY = 252000000000000;

/**
 * Emission speed.
 * @type {number}
 * @constant
 */
Policy.EMISSION_SPEED = Math.pow(2, 22);

/**
 * First block using constant tail emission until total supply is reached.
 * @type {number}
 * @constant
 */
Policy.EMISSION_TAIL_START = 48692960;

/**
 * Constant tail emission in satoshis until total supply is reached.
 * @type {number}
 * @constant
 */
Policy.EMISSION_TAIL_REWARD = 4000;

/* Security parameters */

/**
 * NIPoPoW Security parameter M
 * FIXME naming
 * @type {number}
 * @constant
 */
Policy.M = 240;

/**
 * NIPoPoW Security parameter K
 * FIXME naming
 * @type {number}
 * @constant
 */
Policy.K = 120;

/**
 * NIPoPoW Security parameter DELTA
 * FIXME naming
 * @type {number}
 * @constant
 */
Policy.DELTA = 0.15;

/**
 * Number of blocks the light client downloads to verify the AccountsTree construction.
 * FIXME naming
 * @type {number}
 * @constant
 */
Policy.NUM_BLOCKS_VERIFICATION = 250;


/* Snapshot Parameters */

/**
 * Maximum number of snapshots.
 * @type {number}
 * @constant
 */
Policy.NUM_SNAPSHOTS_MAX = 20;


/**
 * Stores the circulating supply before the given block.
 * @type {Map.<number, number>}
 * @private
 */
Policy._supplyCache = new Map();
Policy._supplyCacheMax = 0; // blocks
Policy._supplyCacheInterval = 5000; // blocks
Class.register(Policy);
