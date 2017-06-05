class BlockUtils {
    static compactToTarget(compact) {
        return (compact & 0xffffff) * Math.pow(2, (8 * ((compact >> 24) - 3)));
    }

    static targetToCompact(target) {
        // Convert the target into base 16 with zero-padding.
        let base16 = target.toString(16);
        if (base16.length % 2 != 0) {
            base16 = "0" + base16;
        }

        // If the first (most significant) byte is greater than 127 (0x7f),
        // prepend a zero byte.
        if (parseInt(base16.substr(0, 2), 16) > 0x7f) {
            base16 = "00" + base16;
        }

        // The first byte of the 'compact' format is the number of bytes,
        // including the prepended zero if it's present.
        let size = base16.length / 2;
        let compact = size << 24;

        // The following three bytes are the first three bytes of the above
        // representation. If less than three bytes are present, then one or
        // more of the last bytes of the compact representation will be zero.
        const numBytes = Math.min(size, 3);
        for (let i = 0; i < numBytes; ++i) {
            compact |= parseInt(base16.substr(i * 2, 2), 16) << ((2 - i) * 8);
        }

        return compact;
    }

    static compactToDifficulty(compact) {
        return Policy.BLOCK_TARGET_MAX / BlockUtils.compactToTarget(compact);
    }

    static difficultyToCompact(difficulty) {
        return BlockUtils.targetToCompact(Policy.BLOCK_TARGET_MAX / difficulty);
    }

    static difficultyToTarget(difficulty) {
        return Policy.BLOCK_TARGET_MAX / difficulty;
    }

    static targetToDifficulty(target) {
        return Policy.BLOCK_TARGET_MAX / target;
    }

    static isProofOfWork(hash, target) {
        return parseInt(hash.toHex(), 16) <= target;
    }

    static isValidCompact(compact) {
        return BlockUtils.isValidTarget(BlockUtils.compactToTarget(compact));
    }

    static isValidTarget(target) {
        return target >= 1 && target <= Policy.BLOCK_TARGET_MAX;
    }
}
Class.register(BlockUtils);
