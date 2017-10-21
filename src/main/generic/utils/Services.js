class Services {
    // XXX Temporary stub, needs to be configurable later on.
    static myServices() {
        // Needs to be != 0 in order to be discoverable by peers.
        return Services.DEFAULT;
    }

    // Used for filtering peer addresses by services.
    static myServiceMask() {
        return 0xffffffff;
    }

    static isFullNode(services) {
        // TODO
        //return services & Services.FULL !== 0;
        return true;
    }
}
Services.DEFAULT = 1;
Services.FULL = 2;
Class.register(Services);
