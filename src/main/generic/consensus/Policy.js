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
     * Number of Satoshis per Nimiq.
     * @type {number}
     * @constant
     */
    static get SATOSHIS_PER_COIN() {
        return 1e8;
    }

    /**
     * Targeted block time in seconds.
     * @type {number}
     * @constant
     */
    static get BLOCK_TIME() {
        return 60; // Seconds
    }

    /**
     * Targeted total supply.
     * @type {number}
     * @constant
     */
    static get TOTAL_SUPPLY() {
        return Policy.coinsToSatoshis(21e6);
    }

    /**
     * Initial supply before genesis block.
     * FIXME: Change for main net.
     * @type {number}
     * @constant
     */
    static get INITIAL_SUPPLY() {
        return Policy.coinsToSatoshis(0);
    }

    /**
     * Emission speed.
     * @type {number}
     * @constant
     */
    static get EMISSION_SPEED() {
        return Math.pow(2, 22);
    }

    /**
     * First block using constant tail emission until total supply is reached.
     * @type {number}
     * @constant
     */
    static get EMISSION_TAIL_START() {
        return 48696986;
    }

    /**
     * Constant amount of tail emission until total supply is reached.
     * @type {number}
     * @constant
     */
    static get EMISSION_TAIL_REWARD() {
        return 4000; // satoshi
    }

    /**
     * First block using new block reward scheme.
     * FIXME: Remove for main net.
     * @type {number}
     * @constant
     */
    static get EMISSION_CURVE_START() {
        return 32000;
    }

    /**
     * Miner reward per block.
     * @param {number} initialSupply
     * @param {number} blockHeight
     * @return {number}
     */
    static _supplyAfter(initialSupply, blockHeight) {
        let supply = initialSupply;
        for (let i = 0; i <= blockHeight; ++i) {
            supply += Policy._blockRewardAt(supply, i);
        }
        return supply;
    }

    /**
     * Miner reward per block.
     * @param {number} currentSupply
     * @param {number} blockHeight
     * @return {number}
     */
    static _blockRewardAt(currentSupply, blockHeight) {
        const remaining = Policy.TOTAL_SUPPLY - currentSupply;
        if (blockHeight >= Policy.EMISSION_TAIL_START && remaining >= Policy.EMISSION_TAIL_REWARD) {
            return Policy.EMISSION_TAIL_REWARD;
        }
        const remainder = remaining % Policy.EMISSION_SPEED;
        return (remaining-remainder) / Policy.EMISSION_SPEED;
    }

    /**
     * Miner reward per block.
     * @param {number} blockHeight
     * @return {number}
     */
    static blockRewardAt(blockHeight) {
        // FIXME: Change for main net.
        if (blockHeight >= Policy.EMISSION_CURVE_START) {
            const initialSupply = Policy.INITIAL_SUPPLY + Policy.EMISSION_CURVE_START * Policy.coinsToSatoshis(5);
            const currentSupply = Policy._supplyAfter(initialSupply, blockHeight-1-Policy.EMISSION_CURVE_START);
            return Policy._blockRewardAt(currentSupply, blockHeight);
        }
        return Policy.coinsToSatoshis(5);
    }

    /**
     * Maximum block size in bytes.
     * @type {number}
     * @constant
     */
    static get BLOCK_SIZE_MAX() {
        return 1e6; // 1 MB
    }

    /**
     * The highest (easiest) block PoW target.
     * @type {number}
     * @constant
     */
    static get BLOCK_TARGET_MAX() {
        return BlockUtils.compactToTarget(0x1f00ffff); // 16 zero bits, bitcoin uses 32 (0x1d00ffff)
    }

    /**
     * Number of blocks we take into account to calculate next difficulty.
     * @type {number}
     * @constant
     */
    static get DIFFICULTY_BLOCK_WINDOW() {
        return 120; // Blocks
    }

    /**
     * Limits the rate at which the difficulty is adjusted min/max.
     * @type {number}
     * @constant
     */
    static get DIFFICULTY_MAX_ADJUSTMENT_FACTOR() {
        return 2;
    }


    /* NIPoPoW parameters */

    /**
     * Security parameter M
     * FIXME naming
     * @type {number}
     * @constant
     */
    static get M() {
        return 240;
    }

    /**
     * Security parameter K
     * FIXME naming
     * @type {number}
     * @constant
     */
    static get K() {
        return 120;
    }

    /**
     * Security parameter DELTA
     * FIXME naming
     * @type {number}
     * @constant
     */
    static get DELTA() {
        return 0.1;
    }

    /* Snapshot Parameters */
    /**
     * Maximum number of snapshots.
     * @type {number}
     * @constant
     */
    static get NUM_SNAPSHOTS_MAX() {
        return 20;
    }

    /**
     * Security parameter M
     * FIXME naming
     * @type {number}
     * @constant
     */
    static get NUM_BLOCKS_VERIFICATION() {
        return 250;
    }
}
Class.register(Policy);
