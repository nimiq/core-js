class PlatformUtils {
    /**
     * @returns {boolean}
     */
    static isBrowser() {
        return typeof window !== 'undefined';
    }

    /**
     * @return {boolean}
     */
    static isNodeJs() {
        return !PlatformUtils.isBrowser() && typeof process === 'object' && typeof require === 'function';
    }

    /**
     * @returns {boolean}
     */
    static supportsWebRTC() {
        let RTCPeerConnection = PlatformUtils.isBrowser() ? (window.RTCPeerConnection || window.webkitRTCPeerConnection) : null;
        return !!RTCPeerConnection;
    }

    /**
     * @returns {boolean}
     */
    static isOnline() {
        return (!PlatformUtils.isBrowser() || !('onLine' in window.navigator)) || window.navigator.onLine;
    }

    // Required for only testing iOS WASM bug on iOS devices
    // FIXME: Remove when iOS 11.3 is sufficiently widespread
    /**
     * @returns {boolean}
     */
    static isiOS() {
        return PlatformUtils.isBrowser() && !window.MSStream && new RegExp("/iPad|iPhone|iPod/").test(navigator.userAgent);
    }

    // Tests for a WASM implementation bug in iOS 11.2.5
    // FIXME: Remove when iOS 11.3 is sufficiently widespread
    /**
     * @returns {boolean}
     */
    static async hasNoBrokenWasmImplementation() {
        // From https://github.com/brion/min-wasm-fail
        const mod = await WebAssembly.compile(iOSWasmTest.wasmBinary);
        const inst = new WebAssembly.Instance(mod, {});
        // test storing to and loading from a non-zero location via a parameter.
        if (inst.exports.test(4)) {
            // ok, we stored a value.
            return true;
        } else {
            // Safari on iOS 11.2.5 returns 0 unexpectedly at non-zero locations
            return false;
        }
    }
}
Class.register(PlatformUtils);
