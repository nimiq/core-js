describe('BlockUtils', () => {
    it('can convert to and from difficulty', ()=>{
        // let difficulty = 0;
        // let difficultyR = BlockUtils.compactToDifficulty(BlockUtils.difficultyToCompact(difficulty));

        // expect(difficultyR).toBe(difficulty);

        let difficulty = 1;
        let difficultyR = BlockUtils.compactToDifficulty(BlockUtils.difficultyToCompact(difficulty));
        
        expect(difficultyR).toBe(difficulty);

        difficulty = 250;
        difficultyR = BlockUtils.compactToDifficulty(BlockUtils.difficultyToCompact(difficulty));
        
        expect(difficultyR).toBe(difficulty);

        difficulty = NumberUtils.UINT32_MAX;
        difficultyR = BlockUtils.compactToDifficulty(BlockUtils.difficultyToCompact(difficulty));
        
        expect(difficultyR).toBe(difficulty);

        difficulty = NumberUtils.UINT64_MAX;
        difficultyR = BlockUtils.compactToDifficulty(BlockUtils.difficultyToCompact(difficulty));
        
        expect(difficultyR).toBe(difficulty);
    });

    it('computes valid targets', ()=>{
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
    });

    it('computes valid compacts', ()=>{
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
    });
});