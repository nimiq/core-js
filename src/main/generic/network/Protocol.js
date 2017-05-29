class Protocol {
    static name(ordinal) {
        switch (ordinal) {
            case Protocol.WS:
                return 'ws';
            case Protocol.RTC:
                return 'rtc';
            default:
                throw 'Invalid protocol';
        }
    }
}
Protocol.WS = 1;
Protocol.RTC = 2;
Class.register(Protocol);
