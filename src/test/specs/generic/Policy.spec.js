describe('Policy', () => {
    it('correctly calculates the block reward and supply', () => {
        let currentSupply = Policy.INITIAL_SUPPLY;

        for (let block = 0; block < 1000; ++block) {
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
        // FIXME: replace initialSupply by Policy.INITIAL_SUPPLY for main net
        const initialSupply = Policy.coinsToSatoshis(25e5);

        expect(Policy._supplyAfter(initialSupply, -1)).toBe(initialSupply, 'Wrong supply.');
    });

    it('reaches total supply after ~100 years', () => {
        // FIXME: replace initialSupply by Policy.INITIAL_SUPPLY for main net
        const initialSupply = Policy.coinsToSatoshis(25e5);

        // Should reach 21mio NIM at block 52893521.
        const block = 101*365*24*60*60 / Policy.BLOCK_TIME; // 101 years
        const supply = Policy._supplyAfter(initialSupply, block-1);
        expect(supply).toBe(Policy.TOTAL_SUPPLY, 'Wrong supply.');
        expect(Policy._blockRewardAt(supply, block)).toBe(0, 'Wrong reward.');
    });

    it('correctly switches to tail emission', () => {
        // FIXME: replace initialSupply by Policy.INITIAL_SUPPLY for main net
        const initialSupply = Policy.coinsToSatoshis(25e5);

        // Should reach 21mio NIM at block 52893521.
        const block = Policy.EMISSION_TAIL_START;
        const supply = Policy._supplyAfter(initialSupply, block-2);
        const previousReward = Policy._blockRewardAt(supply, block-1);
        expect(previousReward > Policy.EMISSION_TAIL_REWARD).toBe(true, 'Wrong reward before starting block.');
        expect(Policy._blockRewardAt(supply + previousReward, block)).toBe(Policy.EMISSION_TAIL_REWARD, 'Wrong reward at starting block.');
    });

    it('correctly calculates LunaNet reward', () => {
        let currentSupply = Policy.INITIAL_SUPPLY;

        expect(Policy.blockRewardAt(0)).toBe(Policy.coinsToSatoshis(5), 'Wrong initial reward.');
        expect(Policy.blockRewardAt(Policy.EMISSION_CURVE_START - 1)).toBe(Policy.coinsToSatoshis(5), 'Wrong reward before curve.');
        const expectedReward = Policy._blockRewardAt(Policy.EMISSION_CURVE_START * Policy.coinsToSatoshis(5), Policy.EMISSION_CURVE_START);
        expect(Policy.blockRewardAt(Policy.EMISSION_CURVE_START)).toBe(expectedReward, 'Wrong reward at curve start.');
    });
});
