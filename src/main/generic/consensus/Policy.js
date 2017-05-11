class Policy {
	static get SATOSHIS_PER_COIN() {
		return 1e8;
	}

	static get BLOCK_TIME() {
		return 30; /* in seconds */
	}

	static get BLOCK_REWARD() {
		return Policy.coinsToSatoshis(50);
	}

	static get BLOCK_SIZE_MAX() {
		return 1e6; // 1 MB
	}

	static get DIFFICULTY_MIN() {
		return 10;
	}

	static get DIFFICULTY_ADJUSTMENT_BLOCKS() {
		return 5; // Blocks
	}

	static coinsToSatoshis(coins) {
		return coins * Policy.SATOSHIS_PER_COIN;
	}

	static satoshisToCoins(satoshis) {
		return satoshis / Policy.SATOSHIS_PER_COIN;
	}
}
Class.register(Policy);
