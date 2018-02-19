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

        expect(target).toEqual(520159232); // TODO

        difficulty = 250;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(503383588); // TODO

        difficulty = NumberUtils.UINT32_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(453050368); // TODO

        difficulty = NumberUtils.UINT64_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(403177472); // TODO

        difficulty = Policy.BLOCK_TARGET_MAX;
        target = BlockUtils.difficultyToCompact(difficulty);

        expect(target).toEqual(16842752);
    });
});
