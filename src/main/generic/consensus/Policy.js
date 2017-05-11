class Policy {
	static get BLOCK_TIME() {
		return 10; /* in seconds */
	}

	static get BLOCK_REWARD() {
		return 50 * 1e4; // XXX Testing
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
}
Class.register(Policy);
