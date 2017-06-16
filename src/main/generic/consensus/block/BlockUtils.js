class BlockUtils {
    static compactToTarget(compact) {
        return (compact & 0xffffff) * Math.pow(2, (8 * ((compact >> 24) - 3)));
    }

    static targetToCompact(target) {
        if (!Number.isFinite(target) || Number.isNaN(target)) throw 'Invalid Target';

        // Divide to get first byte
        let tmp = target;
        let size = 1;
        while (tmp >= 256) {
            size++;
            tmp /= 256;
        }

        let i = 0;

        // If the first (most significant) byte is greater than 127 (0x7f),
        // prepend a zero byte.
        if (tmp >= 0x80) {
            size++;
            i++;
        }

        // The first byte of the 'compact' format is the number of bytes,
        // including the prepended zero if it's present.
        let compact = size << 24;

        // The following three bytes are the first three bytes of the above
        // representation. If less than three bytes are present, then one or
        // more of the last bytes of the compact representation will be zero.
        const numBytes = Math.min(size, 3);
        for (; i < numBytes; ++i) {
            compact |= (Math.floor(tmp) % 256) << ((2 - i) * 8);
            tmp *= 256;
        }

        return compact;
    }

    static compactToDifficulty(compact) {
        return Policy.BLOCK_TARGET_MAX / BlockUtils.compactToTarget(compact);
    }

    static difficultyToCompact(difficulty) {
        return BlockUtils.targetToCompact(BlockUtils.difficultyToTarget(difficulty));
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
