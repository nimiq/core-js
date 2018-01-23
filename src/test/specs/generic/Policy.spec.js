describe('Policy', () => {
    it('correctly calculates the block reward and supply', () => {
        let currentSupply = Policy.INITIAL_SUPPLY;

        for (let block = 1; block < 1000; ++block) {
            const remaining = Policy.TOTAL_SUPPLY - currentSupply;
            const remainder = remaining % Policy.EMISSION_SPEED;
            let reward = (remaining-remainder) / Policy.EMISSION_SPEED;
            if (block >= Policy.EMISSION_TAIL_START && remaining >= Policy.EMISSION_TAIL_REWARD) {
                reward = Policy.EMISSION_TAIL_REWARD;
            }

            expect(Policy._blockRewardAt(currentSupply, block)).toBe(reward, 'Wrong reward.');
            expect(Policy._supplyAfter(Policy.INITIAL_SUPPLY, block-1)).toBe(currentSupply, 'Wrong supply.');
            currentSupply += reward;
        }
    });

    it('correctly computes initial supply', () => {
        expect(Policy._supplyAfter(Policy.INITIAL_SUPPLY, -1)).toBe(Policy.INITIAL_SUPPLY, 'Wrong supply.');
        expect(Policy._supplyAfter(Policy.INITIAL_SUPPLY, 0)).toBe(Policy.INITIAL_SUPPLY, 'Wrong supply.');
    });

    it('reaches total supply after ~100 years', () => {
        // FIXME: replace initialSupply by Policy.INITIAL_SUPPLY for main net
        const initialSupply = 252e12;

        // Should reach 21mio NIM at block 52888984.
        const block = 101*365*24*60*60 / Policy.BLOCK_TIME; // 101 years
        const supply = Policy._supplyAfter(initialSupply, block-1);
        expect(supply).toBe(Policy.TOTAL_SUPPLY, 'Wrong supply.');
        expect(Policy._blockRewardAt(supply, block)).toBe(0, 'Wrong reward.');
    });

    it('correctly switches to tail emission', () => {
        // FIXME: replace initialSupply by Policy.INITIAL_SUPPLY for main net
        const initialSupply = 252e12;

        // Should reach 21mio NIM at block 52888984.
        const block = Policy.EMISSION_TAIL_START;
        const supply = Policy._supplyAfter(initialSupply, block-2);
        const previousReward = Policy._blockRewardAt(supply, block-1);
        expect(previousReward > Policy.EMISSION_TAIL_REWARD).toBe(true, 'Wrong reward before starting block.');
        expect(Policy._blockRewardAt(supply + previousReward, block)).toBe(Policy.EMISSION_TAIL_REWARD, 'Wrong reward at starting block.');
    });

    it('correctly calculates supply', () => {
        expect(Policy.supplyAfter(-1)).toBe(Policy.INITIAL_SUPPLY, 'Wrong initial supply (block -1).');
        expect(Policy.supplyAfter(0)).toBe(Policy.INITIAL_SUPPLY, 'Wrong initial supply (block 0).');
        expect(Policy.supplyAfter(1)).toBe(Policy.INITIAL_SUPPLY + Policy.blockRewardAt(1), 'Wrong initial supply (block 1).');

        for (let block = 0; block < Policy._supplyCacheInterval * 10; block += Policy._supplyCacheInterval) {
            expect(Policy.supplyAfter(block-1)).toBe(Policy._supplyAfter(Policy.INITIAL_SUPPLY, block-1), `Wrong supply for block ${block-1}.`);
            expect(Policy.supplyAfter(block)).toBe(Policy._supplyAfter(Policy.INITIAL_SUPPLY, block), `Wrong supply for block ${block}.`);
            expect(Policy.supplyAfter(block+1)).toBe(Policy._supplyAfter(Policy.INITIAL_SUPPLY, block+1), `Wrong supply for block ${block+1}.`);
        }
    });
});
