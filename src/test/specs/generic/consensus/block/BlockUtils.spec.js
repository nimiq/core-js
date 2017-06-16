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

    it('computes correct compacts', () => {
        let difficulty = 1;
        let target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(520159231);

        difficulty = 250;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(503383587);

        difficulty = NumberUtils.UINT32_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(453050367);

        difficulty = NumberUtils.UINT64_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(403177464);

        difficulty = Policy.BLOCK_TARGET_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(16842752);
    });
});
