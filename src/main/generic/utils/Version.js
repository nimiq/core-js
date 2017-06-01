class Version {
    static isCompatible(code) {
        return code === Version.CODE;
    }
}
Version.CODE = 1;
Class.register(Version);
