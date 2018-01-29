class Version {
    static isCompatible(code) {
        // Allow future, backwards-compatible versions.
        return code >= Version.CODE;
    }
}
Version.CODE = 1;
Class.register(Version);
