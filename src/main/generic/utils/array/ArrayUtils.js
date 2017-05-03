class ArrayUtils {
    static randomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}
Class.register(ArrayUtils);
