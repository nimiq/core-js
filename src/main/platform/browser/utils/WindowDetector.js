class WindowDetector {
    static get KEY_PING() {
        return 'WindowDetector.PING';
    }

    static get KEY_PONG() {
        return 'WindowDetector.PONG';
    }

    static get KEY_BYE() {
        return 'WindowDetector.BYE';
    }

    // Singleton
    static get() {
        if (!WindowDetector._instance) {
            WindowDetector._instance = new WindowDetector();
        }
        return WindowDetector._instance;
    }

    constructor() {
        window.addEventListener('storage', e => {
            if (e.key === WindowDetector.KEY_PING) {
                this._pong(e.newValue);
            }
        });
        window.addEventListener('unload', () => {
            this._bye();
        });
    }

    isSingleWindow() {
        return new Promise((resolve) => {
            const nonce = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
            const timeout = setTimeout( () => {
                window.removeEventListener('storage', listener);
                resolve(true);
            }, 500);

            const listener = e => {
                if (e.key === WindowDetector.KEY_PONG && e.newValue == nonce) {
                    clearTimeout(timeout);

                    window.removeEventListener('storage', listener);
                    resolve(false);
                }
            };
            window.addEventListener('storage', listener);

            this._ping(nonce);
        });
    }

    waitForSingleWindow(fnReady, fnWait) {
        this.isSingleWindow().then( singleWindow => {
            if (singleWindow) {
                fnReady();
            } else {
                if (fnWait) fnWait();

                const listener = e => {
                    if (e.key === WindowDetector.KEY_BYE) {
                        window.removeEventListener('storage', listener);
                        // Don't pass fnWait, we only want it to be called once.
                        this.waitForSingleWindow(fnReady, /*fnWait*/ undefined);
                    }
                };
                window.addEventListener('storage', listener);
            }
        });
    }

    _ping(nonce) {
        localStorage.setItem(WindowDetector.KEY_PING, nonce);
    }

    _pong(nonce) {
        localStorage.setItem(WindowDetector.KEY_PONG, nonce);
    }

    _bye() {
        localStorage.setItem(WindowDetector.KEY_BYE, Date.now());
    }
}
WindowDetector._instance = null;
