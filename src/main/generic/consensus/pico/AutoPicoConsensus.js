class AutoPicoConsensus extends Observable {
    /**
     * @param {PicoChain} picoChain
     * @param {NanoChain} nanoChain
     * @param {BestMiniChain} bestMiniChain
     * @param {NanoMempool} mempool
     * @param {Network} network
     *
     * @returns {AutoPicoConsensus}
     */
    constructor(picoChain, nanoChain, bestMiniChain, mempool, network) {
        super();
        /** @type {NanoMempool} */
        this._mempool = mempool;
        /** @type {Network} */
        this._network = network;
        /** @type {PicoChain} */
        this._picoChain = picoChain;
        /** @type {NanoChain} */
        this._nanoChain = nanoChain;
        /** @type {BestMiniChain} */
        this._bestMiniChain = bestMiniChain;

        this.on('consensus-failed', () => this.migrateToNano());

        this.use(new PicoConsensus(this._picoChain, this._mempool, this._network));
    }

    /**
     * @param {BaseMiniConsensus} consensus
     */
    use(consensus) {
        /** @type {BaseMiniConsensus} */
        this._consensus = consensus;
        this.bubble(this._consensus, '*');
        AutoPicoConsensus._mixin(this, this._consensus, BaseConsensus);
        AutoPicoConsensus._mixin(this, this._consensus, BaseMiniConsensus);
    }

    static _mixin(dest, src, type) {
        for (let name of Object.getOwnPropertyNames(type.prototype)) {
            if (name[0] !== '_' && src[name] && src[name].bind) {
                dest[name] = src[name].bind(src);
            }
        }
    }

    async migrateToNano() {
        if (this.migratedToNano) return;
        this.fire('migrate-to-nano');
        this.fire('lost');
        const newConsensus = new NanoConsensus(this._nanoChain, this._mempool, this._network);
        this._consensus.handoverTo(newConsensus);
        this.use(newConsensus);
        this._network.config.services.provided = Services.NANO;
    }

    /** @type {boolean} */
    get migratedToNano() {
        return this._consensus instanceof NanoConsensus;
    }

    /** @type {Network} */
    get network() {
        return this._network;
    }

    /** @type {NanoMempool} */
    get mempool() {
        return this._mempool;
    }

    /** @type {IBlockchain} */
    get blockchain() {
        return this._bestMiniChain;
    }
}

Class.register(AutoPicoConsensus);

class BestMiniChain extends IBlockchain {
    constructor() {
        super();
    }

    /**
     * @param {AutoPicoConsensus} bestMiniConsensus
     */
    use(bestMiniConsensus) {
        /** @type {AutoPicoConsensus} */
        this._bestMiniConsensus = bestMiniConsensus;
        AutoPicoConsensus._mixin(this, this._bestMiniConsensus._consensus.blockchain, BaseChain);
    }

    get head() {
        return this._bestMiniConsensus._consensus.blockchain.head;
    }

    get headHash() {
        return this._bestMiniConsensus._consensus.blockchain.headHash;
    }

    get height() {
        return this._bestMiniConsensus._consensus.blockchain.height;
    }
}

Class.register(BestMiniChain);
