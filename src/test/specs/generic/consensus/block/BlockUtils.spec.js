describe('BlockUtils', () => {
    it('computes valid targets', () => {
        // let difficulty = 0;
        // let target = BlockUtils.difficultyToTarget(difficulty);

        // expect(BlockUtils.isValidTarget(target)).toBe(true);

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
        let difficulty = 0;
        let target = BlockUtils.difficultyToCompact(difficulty);

        expect(BlockUtils.isValidCompact(target)).toBe(true);

        difficulty = 1;
        target = BlockUtils.difficultyToCompact(difficulty);

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
});
