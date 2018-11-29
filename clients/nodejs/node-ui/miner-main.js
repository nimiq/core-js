class FactsUI {
    constructor() {
        this._peers = document.getElementById('factPeers');
        this._blockHeight = document.getElementById('factBlockHeight');
        this._myHashrate = document.getElementById('factMyHashrate');
        this._myHashrateUnit = document.getElementById('factMyHashrateUnit');
        this._globalHashrate = document.getElementById('factGlobalHashrate');
        this._globalHashrateUnit = document.getElementById('factGlobalHashrateUnit');
        this._myBalance = document.getElementById('factBalance');
        this._myBalanceContainer = document.getElementById('balance');
        this._poolBalance = document.getElementById('factPoolMinerBalance');
        this._expectedHashTime = document.getElementById('factExpectedHashTime');
        this._averageBlockReward = document.getElementById('factAverageBlockReward');
        this._rewardInfoSoloMiner = document.getElementById('rewardInfoSoloMiner');
        this._rewardInfoPoolMiner = document.getElementById('rewardInfoPoolMiner');
        this._blockReward = document.getElementById('factBlockReward');
        this._blockProcessingState = document.getElementById('factBlockProcessingState');
        this._consensusProgress = document.getElementById('progress');
        this._miningSection = document.getElementById('miningSection');
    }

    set peers(peers) {
        this._peers.textContent = peers;
    }

    set blockHeight(height) {
        this._blockHeight.textContent = height;
    }

    set myHashrate(hashrate) {
        this._setHashrate(hashrate, 'my');
    }

    set globalHashrate(hashrate) {
        this._setHashrate(hashrate, 'global');
    }

    set poolEnabled(poolEnabled) {
        if (poolEnabled) {
            this._rewardInfoSoloMiner.style.display = 'none';
            this._rewardInfoPoolMiner.style.display = 'inline';
        } else {
            this._rewardInfoSoloMiner.style.display = 'inline';
            this._rewardInfoPoolMiner.style.display = 'none';
            this._poolBalance.textContent = 'Off';
        }
    }

    set averageBlockReward(lunas) {
        if (!lunas) {
            this._averageBlockReward.textContent = '0 NIM';
            return;
        }
        const nims = Nimiq.Policy.lunasToCoins(lunas);
        if (nims < 0.01) {
            this._averageBlockReward.textContent = lunas.toFixed(2) + ' Luna';
        } else {
            this._averageBlockReward.textContent = nims.toFixed(2) + ' NIM';
        }
    }

    set expectedHashTime(expectedHashTime) {
        if (!Number.isFinite(expectedHashTime)) {
            this._expectedHashTime.innerHTML = '&infin; years';
            return;
        }

        // the time is given in seconds. Convert it to an appropriate base unit:
        const timesteps = [{ unit: 'minutes', factor: 60 }, { unit: 'hours', factor: 60 }, { unit: 'days', factor: 24 },
            { unit: 'months', factor: 365 / 12 }, { unit: 'years', factor: 12 }, { unit: 'decades', factor: 10 }
        ];
        let convertedTime = expectedHashTime;
        let unit = 'seconds';
        for (let i = 0; i < timesteps.length; ++i) {
            const timestep = timesteps[i];
            if (convertedTime / timestep.factor < 1) {
                break;
            } else {
                convertedTime /= timestep.factor;
                unit = timestep.unit;
            }
        }
        this._expectedHashTime.textContent = convertedTime.toFixed(1) + ' ' + unit;
    }

    set myBalance(balance) {
        this._myBalance.textContent = Nimiq.Policy.lunasToCoins(balance).toFixed(2);
    }

    set poolBalance(balance) {
        this._poolBalance.textContent = Nimiq.Policy.lunasToCoins(balance).toFixed(2);
    }

    set address(address) {
        const blockExplorerUrl = 'https://nimiq.watch/';
        this._myBalanceContainer.href = `${blockExplorerUrl}#${address.replace(/ /g, '+')}`;
    }

    set synced(isSynced) {
        if (isSynced) {
            this._blockProcessingState.textContent = 'Mining on';
            this._miningSection.offsetWidth; // enforce an update
            this._miningSection.classList.add('synced');
            setTimeout(function() {
                // change the text when the _consensusProgress is faded out by the synced class
                this._consensusProgress.setAttribute('state', 'synced');
            }.bind(this), 1500);
        } else {
            this._blockProcessingState.textContent = 'Current';
            this._consensusProgress.setAttribute('state', 'syncing');
            this._miningSection.classList.remove('synced');
            this._miningSection.offsetWidth; // enforce an update
        }
    }

    set blockReward(lunas) {
        this._blockReward.textContent = Math.floor(Nimiq.Policy.lunasToCoins(lunas));
    }

    set disconnected(disconnected) {
        if (disconnected) {
            this._miningSection.classList.add('disconnected');
        } else {
            this._miningSection.classList.remove('disconnected');
        }
    }

    _setHashrate(hashrate, type) {
        const steps = ['k', 'M', 'G', 'T', 'P', 'E']; // kilo, mega, giga, tera, peta, exa
        let prefix = '';
        for (let i = 0, step; (step = steps[i]); ++i) {
            if (hashrate / 1000 < 1) {
                break;
            } else {
                hashrate /= 1000;
                prefix = step;
            }
        }
        const unit = `${prefix}H/s`;
        let hashrateEl, unitEl;
        if (type === 'global') {
            hashrateEl = this._globalHashrate;
            unitEl = this._globalHashrateUnit;
        } else {
            hashrateEl = this._myHashrate;
            unitEl = this._myHashrateUnit;
        }
        hashrateEl.textContent = hashrate.toFixed(2);
        unitEl.textContent = unit;
    }
}

class MinerUI {
    constructor(miner) {
        this.miner = miner;

        this._toggleMinerBtn = document.querySelector('#toggleMinerBtn');
        this._toggleMinerBtn.onclick = () => miner.toggleMining();

        this.facts = new FactsUI();

        this._minerSettingsUi = new MinerSettingsUi(document.querySelector('#miner-settings'), this.miner);
        document.querySelector('#my-hashrate').addEventListener('click', () => this._minerSettingsUi.show());
        this._miningPoolsUi = new MiningPoolsUi(document.querySelector('#mining-pools'), this.miner);
        document.querySelector('#pool-miner').addEventListener('click', () => this._miningPoolsUi.show());

        this._warningMinerStopped = document.querySelector('#warning-miner-stopped');
        this._warningDisconnected = document.querySelector('#warning-disconnected');
        this._warningPoolConnection = document.querySelector('#warning-pool-connection');

        const resumeMinerBtn = document.querySelector('#resumeMinerBtn');
        resumeMinerBtn.onclick = () => miner.paused = false;

        const switchToSoloMiningButton = document.querySelector('#warning-pool-connection-switch-solo');
        switchToSoloMiningButton.onclick = () => miner.poolEnabled = false;
    }

    minerStopped() {
        this._toggleMinerBtn.innerText = 'Resume Mining';
        this.facts.myHashrate = 0;
        this.facts.averageBlockReward = 0;
        this.facts.expectedHashTime = Number.POSITIVE_INFINITY;
        if (this._warningPoolConnection.style.opacity === '1' || this._warningDisconnected.style.opacity === '1') return;
        this._warningMinerStopped.style.display = 'block';
        this._warningMinerStopped.offsetWidth; // enforce style update
        this._warningMinerStopped.style.opacity = 1;
        clearTimeout(this._minerWarningTimeout);
    }

    minerWorking() {
        this._toggleMinerBtn.innerText = 'Pause Mining';
        this._warningMinerStopped.style.opacity = 0;
        clearTimeout(this._minerWarningTimeout);
        this._minerWarningTimeout = setTimeout(() => {
            this._warningMinerStopped.style.display = 'none';
        }, 1000);
    }

    hideMinerStoppedWarning() {
        this._warningMinerStopped.style.display = 'none';
        this._warningMinerStopped.style.opacity = 0;
    }

    poolMinerCantConnect() {
        if (this._warningDisconnected.style.opacity === '1') return;
        this.hideMinerStoppedWarning();
        this._warningPoolConnection.style.display = 'block';
        this._warningPoolConnection.offsetWidth; // enforce style update
        this._warningPoolConnection.style.opacity = 1;
        clearTimeout(this._poolMinerWarningTimeout);
    }

    poolMinerCanConnect() {
        this._warningPoolConnection.style.opacity = 0;
        this._poolMinerWarningTimeout = setTimeout(() => {
            this._warningPoolConnection.style.display = 'none';
            if (this.miner.paused) {
                this.minerStopped(); // show miner stopped warning
            }
        }, 1000);
    }

    hidePoolMinerConnectionWarning() {
        this._warningPoolConnection.style.display = 'none';
        this._warningPoolConnection.style.opacity = 0;
    }

    disconnected() {
        this.hideMinerStoppedWarning();
        this.hidePoolMinerConnectionWarning();
        this._warningDisconnected.style.display = 'block';
        this._warningDisconnected.offsetWidth; // enforce style update
        this._warningDisconnected.style.opacity = 1;
        this.facts.disconnected = true;
        clearTimeout(this._disconnectWarningTimeout);
    }

    reconnected() {
        this._warningDisconnected.style.opacity = 0;
        this._disconnectWarningTimeout = setTimeout(() => {
            this._warningDisconnected.style.display = 'none';
            if (this.miner.paused) {
                this.minerStopped(); // show miner stopped warning
            }
        }, 1000);
        this.facts.disconnected = false;
    }
}


class Miner {
    constructor($) {
        this.$ = $;

        this.ui = new MinerUI(this);

        this.$.consensus.on('established', () => this._onConsensusEstablished());
        this.$.consensus.on('lost', () => this._onConsensusSyncing());
        this.$.consensus.on('syncing', () => this._onConsensusSyncing());
        if (this.$.consensus.established) this._onConsensusEstablished();
        else this._onConsensusSyncing();

        this.$.blockchain.on('head-changed', this._onHeadChanged.bind(this));
        this._onHeadChanged();

        this.$.network.on('peers-changed', () => this._onPeersChanged());
        this._onPeersChanged();

        this.$.miner.on('hashrate-changed', () => this._onHashrateChanged());
        this.$.miner.on('enabled', () => this._onMinerEnabled());
        this.$.miner.on('disabled', () => this._onMinerDisabled());
        this.$.miner.on('confirmed-balance', balance => this.ui.facts.poolBalance = balance);
        this.$.miner.on('connection-state', () => this._onPoolMinerConnectionChange());
        this.$.miner.on('pool-enabled', () => this._onPoolEnabled());
        this.$.miner.on('pool-disabled', () => this._onPoolDisabled());
        this.$.miner.on('address-changed', () => this._onAddressChanged());

        if (this.$.miner.enabled) {
            this._onMinerEnabled();
        } else {
            this._onMinerDisabled();
        }

        if (this.poolEnabled) {
            this.connectPool(); // reconnect to the pool if not connected to update the balance
            this._onPoolEnabled();
            this.ui.facts.poolBalance = this.$.miner.confirmedBalance;
            this._onPoolMinerConnectionChange();
        } else {
            this._onPoolDisabled();
        }

        this._onHashrateChanged();
        this._onAddressChanged();
    }

    set threads(threadCount) {
        this.$.miner.threads = threadCount;
    }

    get threads() {
        return this.$.miner.threads;
    }

    get hashrate() {
        return this.$.miner.hashrate;
    }

    get globalHashrate() {
        return this.$.blockchain.head.difficulty * Math.pow(2, 16) / Nimiq.Policy.BLOCK_TIME;
    }

    get paused() {
        return !this.$.miner.enabled;
    }

    set paused(paused) {
        this.$.miner.enabled = !paused;
    }

    get poolEnabled() {
        return !!this.$.miner.pool;
    }

    set poolEnabled(poolEnabled) {
        this.$.miner.pool = !!poolEnabled;
    }

    get selectedPool() {
        return this.$.miner.pool;
    }

    connectPool(host, port) {
        this.$.miner.pool = host && port ? `${host}:${port}` : true;
    }

    toggleMining() {
        this.paused = !this.paused;
    }

    _onConsensusEstablished() {
        this.ui.facts.synced = true;
        this.ui.facts.blockReward = Nimiq.Policy.blockRewardAt(this.$.blockchain.height);
        this.ui.reconnected();

        this._onGlobalHashrateChanged();
        this._updateBalance();
    }

    _onConsensusSyncing() {
        this.ui.facts.synced = false;
    }

    _onPeersChanged() {
        this.ui.facts.peers = this.$.network.peerCount;
        if (this.$.network.peerCount > 0) {
            this.ui.reconnected();
        } else {
            this.ui.disconnected();
        }
    }

    _onHeadChanged() {
        this.ui.facts.blockHeight = this.$.blockchain.height;
        if (this.$.consensus.established) {
            this._onGlobalHashrateChanged();
            this.ui.facts.blockReward = Nimiq.Policy.blockRewardAt(this.$.blockchain.height);
            this._updateBalance();
        }
    }

    _onMinerEnabled() {
        this.ui.minerWorking();
    }

    _onMinerDisabled() {
        // checking for enabled instead of miner.working as if working===false && enabled===false, the miner tries
        // to start automatically and there is no point in asking the user whether he wants to resume mining
        this.ui.minerStopped();
    }

    _onPoolEnabled() {
        this.ui.facts.poolEnabled = true;
        this.ui.facts.poolBalance = this.$.miner.confirmedBalance;
    }

    _onPoolDisabled() {
        this.ui.facts.poolEnabled = false;
        this.ui.hidePoolMinerConnectionWarning();
    }

    _onPoolMinerConnectionChange() {
        const state = this.$.miner.connectionState;
        if (state === Nimiq.BasePoolMiner.ConnectionState.CONNECTED) {
            this.ui.facts.poolBalance = this.$.miner.confirmedBalance || 0;
            this.ui.poolMinerCanConnect();
        } else if (state === Nimiq.BasePoolMiner.ConnectionState.CLOSED
            && this.poolEnabled
            && this._previousPoolConnectionState === Nimiq.BasePoolMiner.ConnectionState.CONNECTING) {
            // connecting failed
            this.ui.poolMinerCantConnect();
        }
        this._previousPoolConnectionState = state;
    }

    _onGlobalHashrateChanged() {
        this.ui.facts.globalHashrate = this.globalHashrate;
        this._onAverageBlockRewardChanged();
        this._onExpectedHashTimeChanged();
    }

    _onHashrateChanged() {
        this.ui.facts.myHashrate = this.hashrate;
        this._onAverageBlockRewardChanged();
        this._onExpectedHashTimeChanged();
    }

    _onAverageBlockRewardChanged() {
        if (!this.poolEnabled) return;
        this.ui.facts.averageBlockReward =
            Math.min(1, this.hashrate / this.globalHashrate) * Nimiq.Policy.blockRewardAt(this.$.blockchain.height);
    }

    _onExpectedHashTimeChanged() {
        if (this.poolEnabled) return;
        const myWinProbability = this.hashrate / this.globalHashrate;
        this.ui.facts.expectedHashTime = (1 / myWinProbability) * Nimiq.Policy.BLOCK_TIME;
    }

    _onAddressChanged() {
        this.ui.facts.address = this.$.miner.address;
        if (this.$.consensus.established) {
            this._updateBalance();
        }
    }

    async _updateBalance() {
        const account = await this.$.accounts.get(this.$.miner.address) || Nimiq.BasicAccount.INITIAL;
        this.ui.facts.myBalance = account.balance;
    }
}


function checkScreenOrientation() {
    // we check the screen dimensions instead of innerWidth/innerHeight for correct behaviour when the keyboard
    // is shown on mobile
    const isLandscape = window.screen.width >= window.screen.height;
    if (isLandscape && window.innerHeight < 480) {
        document.body.classList.add('mobile-landscape');
    } else {
        document.body.classList.remove('mobile-landscape');
    }
}
window.addEventListener('resize', checkScreenOrientation);
checkScreenOrientation();

