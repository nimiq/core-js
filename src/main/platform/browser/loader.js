class Nimiq {
    // Singleton
    static get() {
        if (!Nimiq._core) throw 'Nimiq.get() failed - not initialized yet. Call Nimiq.init() first.';
        return Nimiq._core;
    }

    static _loadScript(url, resolve) {
        // Adding the script tag to the head as suggested before
        let head = document.getElementsByTagName('head')[0];
        let script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        // These events might occur before processing, so delay them a bit.
        let ret = () => window.setTimeout(resolve, 1000);
        script.onreadystatechange = ret;
        script.onload = ret;

        // Fire the loading
        head.appendChild(script);
    }

    static _hasNativeClassSupport() {
        try {
            eval('"use strict"; class A{};'); // eslint-disable-line no-eval
            return true;
        } catch (err) {
            return false;
        }
    }

    static _hasAsyncAwaitSupport() {
        try {
            eval('"use strict"; (async function() { await {}; })()'); // eslint-disable-line no-eval
            return true;
        } catch (err) {
            return false;
        }
    }

    static _hasProperCryptoApi() {
        return window.crypto && window.crypto.subtle;
    }

    static init(ready, wait, path) {
        // Don't initialize core twice.
        if (Nimiq._core) {
            console.warn('Nimiq.init() called more than once.');
            ready(Nimiq._core);
            return;
        }

        let script = 'web.js';

        if (!Nimiq._hasNativeClassSupport()) {
            throw 'Browser unsupported.';
        } else if (!Nimiq._hasAsyncAwaitSupport()) {
            script = 'web-babel.js';
            console.warn('Client lacks native support for async');
        } else if (!Nimiq._hasProperCryptoApi()) {
            script = 'web-crypto.js';
            console.warn('Client lacks native support for crypto routines');
        }

        if (!path) {
            if (Nimiq._currentScript && Nimiq._currentScript.src.indexOf('/') !== -1) {
                path = Nimiq._currentScript.src.substring(0, Nimiq._currentScript.src.lastIndexOf('/') + 1);
            } else {
                // Fallback
                path = './';
            }
        }

        // Wait until there is only a single browser window open for this origin.
        WindowDetector.get().waitForSingleWindow(async function () {
            if (!Nimiq._loaded) {
                await new Promise((resolve) => {
                    Nimiq._onload = () => {
                        resolve();
                    };
                    Nimiq._loadScript(path + script, Nimiq._onload);
                });
                if (!Nimiq._loaded) throw 'Nimiq not loaded even after doing it.';
                console.log('Nimiq engine loaded.');
            }
            Nimiq._core = await new Nimiq.Core();
            ready(Nimiq._core);
        }, wait);
    }
}
Nimiq._currentScript = document.currentScript;
if (!Nimiq._currentScript) {
    // Heuristic
    let scripts = document.getElementsByTagName('script');
    Nimiq._currentScript = scripts[scripts.length - 1];
}
Nimiq._core = null;
Nimiq._onload = null;
Nimiq._loaded = false;
