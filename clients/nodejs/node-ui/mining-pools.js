class MiningPoolsUi extends Overlay {
    constructor(el, miner) {
        super(MiningPoolsUi.ID, el);
        this._el = el;
        this._miner = miner;
        this._poolsList = this._el.querySelector('#mining-pools-list');
        this._detailUi = new MiningPoolDetailUi(el.querySelector('#mining-pool-detail'), miner);

        this._initMiningPoolsList();
    }

    static poolIdFromHostAndPort(host, port) {
        return host + ':' + port;
    }

    static poolIdToHostAndPort(poolId) {
        if (!poolId) return [null, null];
        return poolId.split(':');
    }

    async _loadMiningPools() {
        this._loadMiningPoolsPromise = this._loadMiningPoolsPromise || new Promise(async (resolve, reject) => {
            try {
                const response = await fetch('/mining-pools-mainnet.json');
                const pools = this._shuffleArray(await response.json());
                resolve(pools);
            } catch(e) {
                reject(e);
            }
        });
        return this._loadMiningPoolsPromise;
    }

    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async _initMiningPoolsList() {
        const miningPools = await this._loadMiningPools();
        for (const miningPool of miningPools) {
            const poolId = MiningPoolsUi.poolIdFromHostAndPort(miningPool.host, miningPool.port);
            const radioButton = document.createElement('input');
            radioButton.type = 'radio';
            radioButton.value = poolId;
            radioButton.name = 'mining-pools-list';
            radioButton.id = `mining-pool-${poolId.replace(':', '-')}`;
            radioButton.addEventListener('change', e => this._onPoolSelected(e.target.value));
            const label = document.createElement('label');
            label.textContent = miningPool.name;
            label.setAttribute('for', radioButton.id);
            this._poolsList.appendChild(radioButton);
            this._poolsList.appendChild(label);
        }
        this._selectPool(this._miner.selectedPool);
    }

    _selectPool(poolId) {
        const selectedRadio = this._poolsList.querySelector(`input[value="${poolId}"]`)
            || this._poolsList.querySelector('input:first-of-type'); // arbitrarily select first entry
        if (!selectedRadio) return;
        selectedRadio.checked = true;
        this._onPoolSelected(selectedRadio.value);
    }

    async _onPoolSelected(selectedPoolId) {
        const [host, port] = MiningPoolsUi.poolIdToHostAndPort(selectedPoolId);
        const miningPools = await this._loadMiningPools();
        for (const pool of miningPools) {
            if (pool.host !== host || pool.port !== port) continue;
            this._detailUi.miningPool = pool;
            return;
        }
    }

    show() {
        this._selectPool(this._miner.selectedPool);
        if (this._miner.poolEnabled) {
            // make sure we're connected to update balance
            this._miner.connectPool();
        }
        super.show();
    }

}
MiningPoolsUi.ID = 'mining-pools';



class MiningPoolDetailUi {
    constructor(el, miner) {
        this._el = el;
        this._miner = miner;
        this._miningPoolId = null;
        this._connectionStatus = el.querySelector('#mining-pool-connection-indicator');
        this._joinButton = el.querySelector('#mining-pool-join');
        this._balance = el.querySelector('#mining-pool-info-balance');
        this._joinButton.addEventListener('click', () => this._joinOrLeave());
        this._miner.$.miner.on('connection-state', () => this._updateConnectionStatus());
        this._miner.$.miner.on('pool-changed', () => this._updateConnectionStatus());
        this._miner.$.miner.on('confirmed-balance', () => this._updateBalance());
    }

    set miningPool(miningPool) {
        this._miningPoolId = MiningPoolsUi.poolIdFromHostAndPort(miningPool.host, miningPool.port);
        this._el.querySelector('#mining-pool-info-name').textContent = miningPool.name;
        this._el.querySelector('#mining-pool-info-host').textContent = miningPool.host;
        this._el.querySelector('#mining-pool-info-port').textContent = miningPool.port;
        this._el.querySelector('#mining-pool-info-description').textContent = miningPool.description;
        this._el.querySelector('#mining-pool-info-fees').textContent = miningPool.fees;
        this._el.querySelector('#mining-pool-info-payouts').textContent = miningPool.payouts;
        this._updateConnectionStatus();
        this._updateBalance();
    }

    _updateConnectionStatus() {
        if (this._miningPoolId !== this._miner.selectedPool
            || this._miner.$.miner.connectionState === Nimiq.BasePoolMiner.ConnectionState.CLOSED) {
            this._connectionStatus.setAttribute('status', 'disconnected');
            this._el.removeAttribute('connected');
            this._joinButton.textContent = 'Join';
        } else if (this._miner.$.miner.connectionState === Nimiq.BasePoolMiner.ConnectionState.CONNECTED) {
            this._connectionStatus.setAttribute('status', 'connected');
            this._el.setAttribute('connected', '');
            this._joinButton.textContent = 'Leave';
        } else {
            this._connectionStatus.setAttribute('status', 'connecting');
            this._el.removeAttribute('connected');
            this._joinButton.textContent = 'Leave';
        }
    }

    _updateBalance() {
        const balance = this._miner.$.miner.confirmedBalance;
        this._balance.textContent = Nimiq.Policy.lunasToCoins(balance).toFixed(2);
    }

    _joinOrLeave() {
        if (this._miner.$.miner.connectionState === Nimiq.BasePoolMiner.ConnectionState.CLOSED
            || this._miningPoolId !== this._miner.selectedPool) {
            this._miner.connectPool(...MiningPoolsUi.poolIdToHostAndPort(this._miningPoolId));
        } else {
            this._miner.poolEnabled = false;
        }
    }
}

