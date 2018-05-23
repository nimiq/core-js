/* Miner Settings */

class MinerSettingsUi extends Overlay {
    constructor(el, miner) {
        super(MinerSettingsUi.ID, el);
        this._el = el;
        this._miner = miner;
        this._toggleButton = this._el.querySelector('#miner-settings-toggle-mining');
        this._status = this._el.querySelector('#miner-settings-status');
        this._threadCountLabel = this._el.querySelector('#miner-settings-thread-count');
        this._threadSlider = this._el.querySelector('#miner-settings-thread-slider');
        this._threadSlider.setAttribute('max', navigator.hardwareConcurrency || 8);

        this._miner.$.miner.on('enabled', () => this._onMinerEnabledOrDisabled());
        this._miner.$.miner.on('disabled', () => this._onMinerEnabledOrDisabled());
        this._miner.$.miner.on('hashrate-changed', () => this._updateStatus());
        this._miner.$.miner.on('threads-changed', () => this._onThreadsChanged());
        this._miner.$.consensus.on('*', () => this._updateStatus());
        this._onThreadsChanged();
        this._onMinerEnabledOrDisabled();

        this._toggleButton.addEventListener('click', () => this._miner.toggleMining());
        this._threadSlider.addEventListener('input', // triggered while dragging
            () => this._threadCountLabel.textContent = this._threadSlider.value);
        this._threadSlider.addEventListener('change', // triggered after releasing the slider
            () => this._miner.threads = parseInt(this._threadSlider.value));
    }

    _onThreadsChanged() {
        this._threadCountLabel.textContent = this._miner.threads;
        this._threadSlider.value = this._miner.threads;
        this._updateStatus();
    }

    _onMinerEnabledOrDisabled() {
        this._toggleButton.textContent = this._miner.paused? 'Start' : 'Pause';
        this._updateStatus();
    }

    _updateStatus() {
        if (this._miner.paused) {
            this._status.textContent = 'Mining is paused.';
        } else if (!this._miner.$.consensus.established) {
            this._status.textContent = 'Mining will start as soon as the consensus is established.';
        } else {
            let hashrate = this._miner.hashrate;
            let steps = ['k', 'M', 'G', 'T', 'P', 'E']; // kilo, mega, giga, tera, peta, exa
            let prefix = '';
            for (let i = 0, step; (step = steps[i]); ++i) {
                if (hashrate / 1000 < 1) {
                    break;
                } else {
                    hashrate /= 1000;
                    prefix = step;
                }
            }
            let unit = prefix + 'H/s';
            this._status.textContent = `Mining on ${this._miner.threads} threads at ${hashrate}${unit}`;
        }
    }
}
MinerSettingsUi.ID = 'miner-settings';
