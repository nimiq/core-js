class PeerAddressSeeder extends Observable {
    /**
     * @returns {Promise.<void>}
     */
    async collect() {
        if (!GenesisConfig.SEED_LISTS) {
            this.fire('end');
            return;
        }

        const promises = [];
        for (const listUrl of GenesisConfig.SEED_LISTS) {
            promises.push(SeedList.retrieve(listUrl.url, listUrl.publicKey)
                .then(seedList => {
                    Log.i(PeerAddressSeeder, `Got ${seedList.seeds.length} seed peers from ${listUrl.url}`
                        + (seedList.publicKey && seedList.signature ? ' (signed)' : ''));
                    this.fire('seeds', seedList.seeds);
                })
                .catch(e => Log.w(PeerAddressSeeder, `Failed to retrieve seed list from ${listUrl.url}: ${e.message || e}`)));
        }

        await Promise.all(promises);
        this.fire('end');
    }
}
Class.register(PeerAddressSeeder);
