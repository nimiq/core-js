class Version {
    static isCompatible(code) {
        return code === Version.CODE;
    }
}
Version.CODE = 2;
Class.register(Version);
