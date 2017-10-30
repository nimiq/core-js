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
        return 5; // Seconds
    }

    /**
     * Miner reward per block.
     * @type {number}
     * @constant
     */
    static get BLOCK_REWARD() {
        return Policy.coinsToSatoshis(50);
    }

    /**
     * Maximum block size.
     * @type {number}
     * @constant
     */
    static get BLOCK_SIZE_MAX() {
        return 5e5; // 500 KB
    }

    /**
     * The highest (easiest) block hash target.
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
        return 100; // Blocks
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
        return 300;
    }

    /**
     * Security parameter K
     * FIXME naming
     * @type {number}
     * @constant
     */
    static get K() {
        return 200;
    }

    /**
     * Security parameter DELTA
     * FIXME naming
     * @type {number}
     * @constant
     */
    static get DELTA() {
        return 0.01;
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
}
Class.register(Policy);
