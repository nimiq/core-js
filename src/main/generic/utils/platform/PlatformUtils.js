class PlatformUtils {
    static isBrowser() {
        return typeof window !== "undefined";
    }
}
