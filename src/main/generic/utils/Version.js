class Version {
    static isCompatible(code) {
        return code === Version.CODE;
    }
}
Version.CODE = 4;
Class.register(Version);
