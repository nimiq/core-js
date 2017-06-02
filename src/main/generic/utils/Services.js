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
}
Services.DEFAULT = 1;
Class.register(Services);
