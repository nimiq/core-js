class MinerUi {
    constructor(el, $) {
        if ($.clientType === DevUI.CLIENT_NANO) {
            // nano clients don't have a miner
            el.style.display = 'none';
            return;
        }

        this.$el = el;
        this.$  = $;
        this._lastMinedBlockTimestamp = null;

        this.$working = this.$el.querySelector('[working]');
        this.$hashrate = this.$el.querySelector('[hashrate]');
        this.$lastMinedBlockTimeStamp = this.$el.querySelector('[last-mined-block-timestamp]');
        this.$startButton = this.$el.querySelector('[start-button]');

        $.miner.on('start', () => this._minerChanged());
        $.miner.on('stop', () => this._minerChanged());
        $.miner.on('hashrate-changed', () => this._minerChanged());
        $.miner.on('block-mined', () => this._blockMined());
        $.consensus.on('established', () => this._onConsensusEstablished());
        $.consensus.on('lost', () => this._onConsensusLost());
        this.$startButton.addEventListener('click', () => this._toggleMining());

        this._minerChanged();
    }

    _onConsensusEstablished() {
        //this.$startButton.removeAttribute('disabled');
    }

    _onConsensusLost() {
        this.$.miner.stopWork();
        //this.$startButton.setAttribute('disabled', '');
    }

    _toggleMining() {
        //if (!this.$.consensus.established) {
        //    console.warn('Not starting miner - consensus not established');
        //    return;
        //}
        if (!this.$.miner.working) {
            this.$.miner.startWork();
        } else {
            this.$.miner.stopWork();
        }
    }

    _minerChanged() {
        this.$working.textContent = this.$.miner.working;
        this.$hashrate.textContent = this.$.miner.hashrate;
        this.$lastMinedBlockTimeStamp.textContent = this._lastMinedBlockTimestamp ?
            new Date(this._lastMinedBlockTimestamp) : '-';
        if (this.$.miner.working) {
            this.$startButton.textContent = 'Stop Mining';
        } else {
            this.$startButton.textContent = 'Start Mining';
        }
    }

    _blockMined() {
        this._lastMinedBlockTimestamp = Date.now();
        this._minerChanged();
    }
}
