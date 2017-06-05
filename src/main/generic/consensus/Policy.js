class Policy {
    static get SATOSHIS_PER_COIN() {
        return 1e8;
    }

    static get BLOCK_TIME() {
        return 60; // Seconds
    }

    static get BLOCK_REWARD() {
        return Policy.coinsToSatoshis(50);
    }

    static get BLOCK_SIZE_MAX() {
        return 1e6; // 1 MB
    }

    static get BLOCK_TARGET_MAX() {
        return BlockUtils.compactToTarget(0x1f00ffff); // 16 zero bits, bitcoin uses 32 (0x1d00ffff)
    }

    static get DIFFICULTY_ADJUSTMENT_BLOCKS() {
        return 10; // Blocks
    }

    static coinsToSatoshis(coins) {
        return Math.round(coins * Policy.SATOSHIS_PER_COIN);
    }

    static satoshisToCoins(satoshis) {
        return satoshis / Policy.SATOSHIS_PER_COIN;
    }
}
Class.register(Policy);
