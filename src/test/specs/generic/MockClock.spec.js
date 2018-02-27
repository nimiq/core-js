class MockClock {
    /**
     * @returns {void}
     */
    static install() {
        if (! MockClock._instance) {
            MockClock._instance = new MockClock();
        }
        MockClock._instance._install();
    }

    /**
     * @returns {void}
     */
    static uninstall() {
        if (MockClock._instance) {
            MockClock._instance._uninstall();
        }
    }

    /**
     * @param {number} millis
     * @returns {void}
     */
    static tick(millis) {
        if (MockClock._instance) {
            MockClock._instance._tick(millis);
        }
    }


    /**
     * @constructor
     */
    constructor() {
        // Backup of the original functions
        /**
         * @type {function}
         */
        this._setInterval = null;

        /**
         * @type {function}
         */
        this._clearInterval = null;

        /**
         * @type {number}
         */
        this._interval = null;
    }

    /**
     * @returns {void}
     */
    _install() {
        // Backup the original functions
        this._setInterval = setInterval;
        this._clearInterval = clearInterval;

        // start jasmin clock
        jasmine.clock().install();
        jasmine.clock().mockDate();

        // hack to prevent jasmin delivering non-integer dates
        const dateNow = Date.now;
        spyOn(Date, 'now').and.callFake(() => Math.round(dateNow()));

        // don't call setInterval with object context
        const si = this._setInterval;
        this._interval = si(() => jasmine.clock().tick(100), 100);
    }

    /**
     * @returns {void}
     */
    _uninstall() {
        // don't call clearInterval with object context
        const ci = this._clearInterval;
        ci(this._interval);

        jasmine.clock().uninstall();
    }

    /**
     * @param {number} millis
     * @returns {void}
     */
    _tick(millis) {
        if (this._interval) {
            jasmine.clock().tick(millis);
        }
    }
}
MockClock._instance = null;

Class.register(MockClock);
