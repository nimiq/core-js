/**
 * Base entry point to the Nimiq library.
 */
class Nimiq {
    /**
     * Get the loaded instance of the Nimiq {@link Core}. {@link Nimiq.init} must be invoked before.
     * @returns {Core}
     */
    static get() {
        if (!Nimiq._core) throw 'Nimiq.get() failed - not initialized yet. Call Nimiq.init() first.';
        return Nimiq._core;
    }

    static _loadScript(url, resolve) {
        // Adding the script tag to the head as suggested before
        const head = document.getElementsByTagName('head')[0];
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        // These events might occur before processing, so delay them a bit.
        const ret = () => window.setTimeout(resolve, 1000);
        script.onreadystatechange = ret;
        script.onload = ret;

        // Fire the loading
        head.appendChild(script);
    }

    /**
     * Load the Nimiq library.
     * @param {string|undefined} path Path that contains the required files to load the library.
     * @returns {Promise} Promise that resolves once the library was loaded.
     */
    static load(path) {
        if (!Nimiq._hasNativePromise()) return Nimiq._unsupportedPromise();
        Nimiq._loadPromise = Nimiq._loadPromise ||
            new Promise(async (resolve, error) => {
                let script = 'web.js';

                if (!Nimiq._hasNativeClassSupport() || !Nimiq._hasProperScoping()) {
                    console.error('Unsupported browser');
                    error(Nimiq.ERR_UNSUPPORTED);
                    return;
                } else if (!Nimiq._hasAsyncAwaitSupport()) {
                    script = 'web-babel.js';
                    console.warn('Client lacks native support for async');
                } else if (!Nimiq._hasProperCryptoApi() || !Nimiq._hasProperWebRTCOrNone()) {
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

                Nimiq._onload = () => {
                    if (!Nimiq._loaded) {
                        error(Nimiq.ERR_UNKNOWN);
                    } else {
                        resolve();
                    }
                };
                Nimiq._loadScript(path + script, Nimiq._onload);
            });
        return Nimiq._loadPromise;
    }

    static _hasNativeClassSupport() {
        try {
            eval('"use strict"; class A{}'); // eslint-disable-line no-eval
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

    static _hasProperWebRTCOrNone() {
        window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        return !window.RTCPeerConnection || window.RTCPeerConnection.generateCertificate;
    }

    static _hasProperScoping() {
        try {
            eval('"use strict"; class a{ a() { const a = 0; } }'); // eslint-disable-line no-eval
            return true;
        } catch (err) {
            return false;
        }
    }

    static _hasNativePromise() {
        return window.Promise;
    }

    static _unsupportedPromise() {
        return {
            'catch': function (handler) {
                handler(Nimiq.ERR_UNSUPPORTED);
            },
            'then': function () {}
        };
    }

    static _hasNativeGoodies() {
        return window.Number && window.Number.isInteger;
    }

    /**
     * Load the Nimiq library, initialize and provide a {@link Core} instance.
     * @param {function(Core)} ready Function that is invoked once the Core was initialized.
     * @param {function(number)} error Function that is invoked if the call failed.
     * @param {object} options Options for the {@link Core} constructor.
     */
    static init(ready, error, options = {}) {
        // Don't initialize core twice.
        if (Nimiq._core) {
            console.warn('Nimiq.init() called more than once.');
            if (ready) ready(Nimiq._core);
            return;
        }

        if (!Nimiq._hasNativePromise() || !Nimiq._hasNativeGoodies()) {
            if (error) error(Nimiq.ERR_UNSUPPORTED);
            return;
        }

        // Wait until there is only a single browser window open for this origin.
        WindowDetector.get().waitForSingleWindow(async function () {
            try {
                await Nimiq.load();
                console.log('Nimiq engine loaded.');
                Nimiq._core = await new Nimiq.Core(options);
                if (ready) ready(Nimiq._core);
            } catch (e) {
                if (Number.isInteger(e)) {
                    if (error) error(e);
                } else {
                    console.error('Error while initializing the core', e);
                    if (error) error(Nimiq.ERR_UNKNOWN);
                }
            }
        }, () => error && error(Nimiq.ERR_WAIT));
    }
}
Nimiq._currentScript = document.currentScript;
if (!Nimiq._currentScript) {
    // Heuristic
    const scripts = document.getElementsByTagName('script');
    Nimiq._currentScript = scripts[scripts.length - 1];
}
Nimiq.ERR_WAIT = -1;
Nimiq.ERR_UNSUPPORTED = -2;
Nimiq.ERR_UNKNOWN = -3;
Nimiq._core = null;
Nimiq._onload = null;
Nimiq._loaded = false;
Nimiq._loadPromise = null;
