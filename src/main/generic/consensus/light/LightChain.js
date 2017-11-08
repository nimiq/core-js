class LightChain extends FullChain {
    /**
    * @param {JungleDB} jdb
    * @param {Accounts} accounts
    * @returns {Promise.<LightChain>}
    */
    static getPersistent(jdb, accounts) {
        const store = ChainDataStore.getPersistent(jdb);
        const chain = new LightChain(store, accounts);
        return chain._init();
    }

    /**
     * @param {Accounts} accounts
     * @returns {Promise.<LightChain>}
     */
    static createVolatile(accounts) {
        const store = ChainDataStore.createVolatile();
        const chain = new LightChain(store, accounts);
        return chain._init();
    }

    /**
     * @param {ChainDataStore} store
     * @param {Accounts} accounts
     * @returns {PartialLightChain}
     */
    constructor(store, accounts) {
        super(store, accounts);

        this._proof = new ChainProof(new BlockChain([Block.GENESIS.toLight()]), new HeaderChain([]));
    }

    async _updateHead() {
        this._headHash = await this._store.getHead();
        this._mainChain = await this._store.getChainData(this._headHash);
        this.fire('head-changed', this.head);
    }

    partialChain() {
        const partialChain = new PartialLightChain(this._store, this._accounts, this._proof);
        partialChain.on('committed', (proof) => {
            this._proof = proof;
            this._updateHead();
        });
        return partialChain;
    }
}
Class.register(LightChain);
