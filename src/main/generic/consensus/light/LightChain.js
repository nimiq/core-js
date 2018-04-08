/**
 * A LightChain is initialized by using NiPoPoWs instead of the full
 * blockchain history, but after initialization, it behaves as a regular
 * full blockchain.
 */
class LightChain extends FullChain {
    /**
    * @param {JungleDB} jdb
    * @param {Accounts} accounts
    * @param {Time} time
    * @returns {Promise.<LightChain>}
    */
    static getPersistent(jdb, accounts, time) {
        const store = ChainDataStore.getPersistent(jdb);
        const chain = new LightChain(store, accounts, time);
        return chain._init();
    }

    /**
     * @param {Accounts} accounts
     * @param {Time} time
     * @returns {Promise.<LightChain>}
     */
    static createVolatile(accounts, time) {
        const store = ChainDataStore.createVolatile();
        const chain = new LightChain(store, accounts, time);
        return chain._init();
    }

    /**
     * @param {ChainDataStore} store
     * @param {Accounts} accounts
     * @param {Time} time
     * @returns {PartialLightChain}
     */
    constructor(store, accounts, time) {
        super(store, accounts, time);
    }

    /**
     * @override
     * @protected
     */
    async _init() {
        // FIXME: this is a workaround as Babel doesn't understand await super().
        await FullChain.prototype._init.call(this);
        if (!this._proof) {
            this._proof = await this._getChainProof();
        }
        return this;
    }

    /**
     * @return {PartialLightChain}
     */
    async partialChain() {
        const proof = await this.getChainProof();
        const partialChain = new PartialLightChain(this._store, this._accounts, this._time, proof, this._synchronizer);
        partialChain.on('committed', (proof, headHash, mainChain, transactionCache) => {
            this._proof = proof;
            this._headHash = headHash;
            this._mainChain = mainChain;
            this._transactionCache = transactionCache;
            this.fire('head-changed', this.head);
        });
        await partialChain._init();
        return partialChain;
    }

    /**
     * @returns {boolean}
     * @private
     * @override
     */
    _shouldExtendChainProof() {
        return true;
    }
}
Class.register(LightChain);
