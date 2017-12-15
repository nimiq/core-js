class Services {
    /**
     * @constructor
     * @param {number} [provided=Services.NONE] Bitmap of services that can be provided
     * @param {number} [accepted=Services.NONE] Bitmap of services that can be accepted
     */
    constructor(provided = Services.NONE, accepted = Services.NONE) {
        this._provided = provided;
        this._accepted = accepted;
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
     * Set the type without affecting other provided services
     * @param {number} type
     */
    set type(type) {
        // The type is enconded in the 3 lsb, we clear them before setting the type
        this._provided |= (type & 0xFFFFFFF8);
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
