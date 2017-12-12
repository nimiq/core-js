class Services {
    /**
     * @constructor
     * @param {number} provided Bitmap of services that can be provided
     * @param {number} accepted Bitmap of services that can be accepted
     */
    constructor(provided, accepted) {
        this._provided = provided || Services.NONE;
        this._accepted = accepted || Services.NONE;
    }

    /**
     * @type {number}
     */
    get provided() {
        return this._provided;
    }

    /**
     * @type {number}
     */
    get accepted() {
        return this._accepted;
    }

    /**
     * @param {number} services Bitmap of services that can be provided
     */
    set provided(services) {
        this._provided = services;
    }

    /**
     * @param {number} services Bitmap of services that can be accepted
     */
    set accepted(services) {
        this._accepted = services;
    }

    /**
     * @param {number} services Bitmap of the services to check
     * @returns {boolean}
     */
    static isFullNode(services) {
        return (services & Services.FULL) !== 0;
    }

    /**
     * @param {number} services Bitmap of the services to check
     * @returns {boolean}
     */
    static isLightNode(services) {
        return (services & Services.LIGHT) !== 0;
    }

    /**
     * @param {number} services Bitmap of the services to check
     * @returns {boolean}
     */
    static isNanoNode(services) {
        return services === Services.NANO;
    }
}
Services.NONE   = 0;
Services.NANO   = 1;
Services.LIGHT  = 2;
Services.FULL   = 4;
Services.INDEX  = 8;
Class.register(Services);
