class RpcSettingsUi extends Overlay {
    constructor(el, rpcClient) {
        super(RpcSettingsUi.ID, el);
        this._rpcClient = rpcClient;
        this._overlay = el.querySelector('.overlay');
        this._warning = el.querySelector('#rpc-settings-warning');
        this._connectButton = el.querySelector('#rpc-settings-connect');
        this._form = el.querySelector('#rpc-settings-form');
        this._userInput = el.querySelector('#rpc-settings-user');
        this._passwordInput = el.querySelector('#rpc-settings-password');
        this._portInput = el.querySelector('#rpc-settings-port');
        this._portInput.value = this._rpcClient.port || 8648;

        this._form.addEventListener('submit', event => {
            event.preventDefault();
            this._checkConnection();
        });
    }

    async _checkConnection() {
        this._rpcClient.user = this._userInput.value;
        this._rpcClient.password = this._passwordInput.value;
        this._rpcClient.port = this._portInput.value;
        if (!await this._rpcClient.ping()) {
            this._warning.textContent = 'Could not connect to the miner. Please review your settings.';
            this._warning.style.paddingBottom = '16px';
            this._overlay.style.animation = 'shake .5s';
            setTimeout(() => this._overlay.style.animation = null, 500);
        } else {
            super.hide();
        }
    }

    show() {
        super.show();
        this._userInput.focus();
    }

    hide() {} // disable closing of overlay by user
}
RpcSettingsUi.ID = 'rpc-settings';
