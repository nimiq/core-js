describe('Queue', () => {
    it('correctly dequeues elements', () => {
        const q = new Queue();

        expect(q.length).toBe(0);

        q.enqueue(3);
        q.enqueue(1);
        q.enqueue(2);

        expect(q.length).toBe(3);
        expect(q.dequeue()).toBe(3);
        expect(q.length).toBe(2);
        expect(q.dequeue()).toBe(1);
        expect(q.length).toBe(1);
        expect(q.dequeue()).toBe(2);
        expect(q.length).toBe(0);
    });

    it('can clear itself', () => {
        const q = new Queue();

        q.enqueue(3);
        q.enqueue(1);
        q.enqueue(2);

        expect(q.length).toBe(3);
        q.clear();
        expect(q.length).toBe(0);
        expect(q.dequeue()).toBeFalsy();
    });

    it('can peek', () => {
        const q = new Queue();

        q.enqueue(3);
        q.enqueue(1);

        expect(q.peek()).toBe(3);
        q.dequeue();
        expect(q.peek()).toBe(1);
        q.dequeue();
        expect(q.peek()).toBeFalsy();
    });

    it('can dequeueMulti', () => {
        const q = new Queue();

        q.enqueue(3);
        q.enqueue(1);
        q.enqueue(2);

        expect(q.dequeueMulti(2)).toEqual([3, 1]);
        expect(q.dequeueMulti(2)).toEqual([2]);
        expect(q.dequeueMulti(2)).toEqual([]);
    });
});
