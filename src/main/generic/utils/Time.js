class Time {
    static now() {
        return Date.now() + Time._timeOffset;
    }

    static set timeOffset(offset) {
        Time._timeOffset = offset;
    }
}
Time._timeOffset = 0;
Class.register(Time);
