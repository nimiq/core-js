// TODO: Implement Block Size Limit
// TODO V2: Implement total coins limit
class Policy {
	static get BLOCK_TIME() {
		return 10; /* in seconds */
	}

	static get BLOCK_REWARD() {
		return 50 * 1e4;
	}
}
