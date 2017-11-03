class Services {
    static myServices() {
        if (!Services._myServices) throw new Error('Services are not configured');
        return Services._myServices;
    }

    // Used for filtering peer addresses by services.
    static myServiceMask() {
        if (!Services._myServiceMask) throw new Error('ServiceMask is not configured');
        return Services._myServiceMask;
    }

    static configureServices(services) {
        Services._myServices = services;
    }

    static configureServiceMask(serviceMask) {
        Services._myServiceMask = serviceMask;
    }

    static isFullNode(services) {
        return (services & Services.FULL) !== 0;
    }

    static isNanoNode(services) {
        return services === Services.NANO;
    }
}
Services.NANO   = 1;
Services.LIGHT  = 2;
Services.FULL   = 4;
Services.INDEX  = 8;
Class.register(Services);
