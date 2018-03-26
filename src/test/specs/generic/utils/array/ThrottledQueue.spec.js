describe('ThrottledQueue', () => {
    it('can enqueue and dequeue like a Queue', () => {
        const queue = new ThrottledQueue(1000);

        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);
        queue.enqueue(4);

        expect(queue.dequeue()).toBe(1);
        expect(queue.dequeueMulti(2)).toEqual([2, 3]);
        expect(queue.isAvailable()).toBeTruthy();
        expect(queue.available).toBe(1);

        queue.stop();
    });

    it('can throttle output and call callback', (done) => {
        let queue, expected = 2;
        queue = new ThrottledQueue(1, 1, 50, 10, () => {
            expect(queue.dequeue()).toBe(expected);
            expected++;
            if (expected === 5) {
                queue.stop();
                done();
            }
        });
        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);
        queue.enqueue(4);
        expect(queue.dequeue()).toBe(1);
        expect(queue.dequeue()).toBeNull();
    });
});
