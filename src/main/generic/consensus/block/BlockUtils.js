class BlockUtils {
    /**
     * @param {number} compact
     * @returns {number}
     */
    static compactToTarget(compact) {
        return (compact & 0xffffff) * Math.pow(2, (8 * ((compact >> 24) - 3)));
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static targetToCompact(target) {
        if (!Number.isFinite(target) || Number.isNaN(target)) throw 'Invalid Target';

        // Divide to get first byte
        let size = Math.max(Math.ceil(Math.log2(target) / 8), 1);
        const firstByte = target / Math.pow(2, (size - 1) * 8);

        // If the first (most significant) byte is greater than 127 (0x7f),
        // prepend a zero byte.
        if (firstByte >= 0x80) {
            size++;
        }

        // The first byte of the 'compact' format is the number of bytes,
        // including the prepended zero if it's present.
        // The following three bytes are the first three bytes of the above
        // representation. If less than three bytes are present, then one or
        // more of the last bytes of the compact representation will be zero.
        return (size << 24) + ((target / Math.pow(2, (size - 3) * 8)) & 0xffffff);
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static getTargetHeight(target) {
        return Math.ceil(Math.log2(target));
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static getTargetDepth(target) {
        return BlockUtils.getTargetHeight(Policy.BLOCK_TARGET_MAX) - BlockUtils.getTargetHeight(target);
    }

    /**
     * @param {number} compact
     * @returns {number}
     */
    static compactToDifficulty(compact) {
        return Policy.BLOCK_TARGET_MAX / BlockUtils.compactToTarget(compact);
    }

    /**
     * @param {number} difficulty
     * @returns {number}
     */
    static difficultyToCompact(difficulty) {
        return BlockUtils.targetToCompact(BlockUtils.difficultyToTarget(difficulty));
    }

    /**
     * @param {number} difficulty
     * @returns {number}
     */
    static difficultyToTarget(difficulty) {
        return Policy.BLOCK_TARGET_MAX / difficulty;
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static targetToDifficulty(target) {
        return Policy.BLOCK_TARGET_MAX / target;
    }

    /**
     * @param {Hash} hash
     * @returns {number}
     */
    static hashToTarget(hash) {
        return parseInt(hash.toHex(), 16);
    }

    /**
     * @param {Hash} hash
     * @returns {number}
     */
    static realDifficulty(hash) {
        return BlockUtils.targetToDifficulty(BlockUtils.hashToTarget(hash));
    }

    /**
     * @param {Hash} hash
     * @param {number} target
     * @returns {boolean}
     */
    static isProofOfWork(hash, target) {
        return parseInt(hash.toHex(), 16) <= target;
    }

    /**
     * @param {number} compact
     * @returns {boolean}
     */

    static isValidCompact(compact) {
        return BlockUtils.isValidTarget(BlockUtils.compactToTarget(compact));
    }

    /**
     * @param {number} target
     * @returns {boolean}
     */
    static isValidTarget(target) {
        return target >= 1 && target <= Policy.BLOCK_TARGET_MAX;
    }
}
Class.register(BlockUtils);
