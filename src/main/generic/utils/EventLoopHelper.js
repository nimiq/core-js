class EventLoopHelper {
    static webYield() {
        return PlatformUtils.isWeb() ? EventLoopHelper.yield() : Promise.resolve();
    }

    static yield() {
        return new Promise((resolve) => setTimeout(resolve));
    }
}

Class.register(EventLoopHelper);
