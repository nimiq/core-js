class WindowDetector {
    // Singleton
    static get() {
        if (!WindowDetector._instance) {
            WindowDetector._instance = new WindowDetector();
        }
        return WindowDetector._instance;
    }

    isSingleWindow() {
        return Promise.resolve(true);
    }

    waitForSingleWindow(fnReady, fnWait) {
        setTimeout(fnReady, 1);
    }
}
WindowDetector._instance = null;
Class.register(WindowDetector);
