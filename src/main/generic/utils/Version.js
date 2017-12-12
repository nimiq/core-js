class Version {
    static isCompatible(code) {
        return code === Version.CODE;
    }
}
Version.CODE = 3;
Class.register(Version);
