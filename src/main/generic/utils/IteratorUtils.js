class IteratorUtils {
    static alternate(...iterators) {
        const numIterators = iterators.length;
        let i = 0, done = false;
        const it = () => {
            if (!done) {
                for (let tries = 0; tries < numIterators; tries++) {
                    const result = iterators[i].next();
                    i = (i + 1) % numIterators;
                    if (!result.done) {
                        return result;
                    }
                }
            }
            done = true;
            return {done: true};
        };
        return {
            next: it,
            [Symbol.iterator]: () => { return { next: it }; }
        };
    }
}
Class.register(IteratorUtils);
