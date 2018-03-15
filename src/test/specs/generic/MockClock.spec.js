class MockClock {
    /**
     * @returns {void}
     */
    static install() {
        if (!MockClock._instance) {
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
     * @param {number} rate
     * @returns {void}
     */
    static start(rate = null) {
        if (MockClock._instance) {
            if (rate) {
                MockClock._instance._rate = rate;
            }
            MockClock._instance._start();
        }
    }

    /**
     * @returns {void}
     */
    static stop() {
        if (MockClock._instance) {
            MockClock._instance._stop();
        }
    }

    /** @type {boolean} */
    static get running() {
        if (MockClock._instance) {
            return MockClock._instance._running();
        }
        return false;
    }

    /** @type {number} */
    static get speed() {
        if (MockClock._instance) {
            return MockClock._instance._speed;
        }
        return 1;
    }

    /** @param {number} value*/
    static set speed(value) {
        if (MockClock._instance) {
            MockClock._instance._speed = value;
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
         * @type {Number}
         */
        this._interval = null;

        /**
         * @type {number}
         */
        this._speed = 1;

        /**
         * @type {number}
         */
        this._rate = 10;
    }

    /**
     * @param {boolean} start
     * @returns {void}
     */
    _install(start = true) {
        // Backup the original functions
        this._setInterval = setInterval;
        this._clearInterval = clearInterval;

        // start jasmin clock
        jasmine.clock().install();
        jasmine.clock().mockDate();

        // hack to prevent jasmin delivering non-integer dates
        const dateNow = Date.now;
        spyOn(Date, 'now').and.callFake(() => Math.round(dateNow()));

        if (start) {
            this._start();
        }
    }

    /**
     * @returns {void}
     */
    _start() {
        // don't call setInterval with object context
        const si = this._setInterval;
        this._interval = si(() => jasmine.clock().tick(this._rate * this._speed), this._rate);
    }

    /**
     * @returns {void}
     */
    _stop() {
        // don't call clearInterval with object context
        const ci = this._clearInterval;
        ci(this._interval);
        this._interval = null;
    }

    /**
     * @returns {void}
     */
    _uninstall() {
        this._stop();

        jasmine.clock().uninstall();

        MockClock._instance = null;
    }

    /**
     * @returns {boolean}
     */
    _running() {
        return this._interval === null;
    }

    /**
     * @param {number} millis
     * @returns {void}
     */
    _tick(millis) {
        jasmine.clock().tick(millis);
    }
}
MockClock._instance = null;

Class.register(MockClock);
