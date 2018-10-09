describe('BlockUtils', () => {
    it('computes valid targets', () => {
        let difficulty = 1;
        let target = BlockUtils.difficultyToTarget(difficulty);

        expect(BlockUtils.isValidTarget(target)).toBe(true);

        difficulty = 250;
        target = BlockUtils.difficultyToTarget(difficulty);

        expect(BlockUtils.isValidTarget(target)).toBe(true);

        difficulty = NumberUtils.UINT32_MAX;
        target = BlockUtils.difficultyToTarget(difficulty);

        expect(BlockUtils.isValidTarget(target)).toBe(true);

        difficulty = NumberUtils.UINT64_MAX;
        target = BlockUtils.difficultyToTarget(difficulty);

        expect(BlockUtils.isValidTarget(target)).toBe(true);

        difficulty = Policy.BLOCK_TARGET_MAX;
        target = BlockUtils.difficultyToTarget(difficulty);

        expect(BlockUtils.isValidTarget(target)).toBe(true);
    });

    it('computes valid compacts', () => {
        let difficulty = 1;
        let target = BlockUtils.difficultyToCompact(difficulty);

        expect(BlockUtils.isValidCompact(target)).toBe(true);

        difficulty = 250;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(BlockUtils.isValidCompact(target)).toBe(true);

        difficulty = NumberUtils.UINT32_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(BlockUtils.isValidCompact(target)).toBe(true);

        difficulty = NumberUtils.UINT64_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(BlockUtils.isValidCompact(target)).toBe(true);

        difficulty = Policy.BLOCK_TARGET_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(BlockUtils.isValidCompact(target)).toBe(true);
    });

    it('computes correct compacts from difficulty', () => {
        let difficulty = 1;
        let target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(0x1f010000);

        difficulty = 250;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(0x1e010624);

        difficulty = NumberUtils.UINT32_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(0x1b010000);

        difficulty = NumberUtils.UINT64_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(0x18080000);

        difficulty = Policy.BLOCK_TARGET_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(0x01000001);
    });

    it('correctly computes targets from compact', () => {
        expect(BlockUtils.compactToTarget(0x01000001).toNumber()).toEqual(1);
        expect(BlockUtils.compactToTarget(0x0200ffff).toNumber()).toEqual(0xffff);
        expect(BlockUtils.compactToTarget(0x037fffff).toNumber()).toEqual(0x7fffff);
        expect(BlockUtils.compactToTarget(0x0380ffff).toNumber()).toEqual(0x80ffff);
        expect(BlockUtils.compactToTarget(0x040080ff).toNumber()).toEqual(0x80ff00);
    });

    it('computes correct targets from difficulty', () => {
        let target = BlockUtils.difficultyToTarget(new BigNumber(1));
        expect(target.eq(Policy.BLOCK_TARGET_MAX)).toBe(true);

        target = BlockUtils.difficultyToTarget(Policy.BLOCK_TARGET_MAX);
        expect(target.eq(new BigNumber(1))).toBe(true);
    });

    it('computes correct target depth', () => {
        expect(BlockUtils.getTargetDepth(BlockUtils.compactToTarget(0x1f010000))).toEqual(0);
        expect(BlockUtils.getTargetDepth(BlockUtils.compactToTarget(0x1f008f00))).toEqual(0);
        expect(BlockUtils.getTargetDepth(BlockUtils.compactToTarget(0x1f008000))).toEqual(1);
        expect(BlockUtils.getTargetDepth(BlockUtils.compactToTarget(0x1e600000))).toEqual(1);
        expect(BlockUtils.getTargetDepth(BlockUtils.compactToTarget(0x1e400000))).toEqual(2);
        expect(BlockUtils.getTargetDepth(BlockUtils.compactToTarget(0x01000002))).toEqual(239);
        expect(BlockUtils.getTargetDepth(BlockUtils.compactToTarget(0x01000001))).toEqual(240);
    });
});
