describe('UniqueQueue', () => {
    it('correctly dequeues elements', () => {
        const q = new UniqueQueue();

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
        const q = new UniqueQueue();

        q.enqueue(3);
        q.enqueue(1);
        q.enqueue(2);

        expect(q.length).toBe(3);
        q.clear();
        expect(q.length).toBe(0);
        expect(q.dequeue()).toBeFalsy();
    });

    it('can peek', () => {
        const q = new UniqueQueue();

        q.enqueue(3);
        q.enqueue(1);

        expect(q.peek()).toBe(3);
        q.dequeue();
        expect(q.peek()).toBe(1);
        q.dequeue();
        expect(q.peek()).toBeFalsy();
    });

    it('can dequeueMulti', () => {
        const q = new UniqueQueue();

        q.enqueue(3);
        q.enqueue(1);
        q.enqueue(2);

        expect(q.dequeueMulti(2)).toEqual([3, 1]);
        expect(q.dequeueMulti(2)).toEqual([2]);
        expect(q.dequeueMulti(2)).toEqual([]);
    });

    it('can enqueue unique', () => {
        const q = new UniqueQueue();

        q.enqueue(3);
        q.enqueue(1);
        q.enqueue(2);
        q.enqueue(3);
        q.enqueue(2);

        expect(q.length).toBe(3);
        expect(q.dequeue()).toBe(3);
        expect(q.dequeue()).toBe(1);
        expect(q.dequeue()).toBe(2);
    });

    it('can enqueueAll', () => {
        const q = new UniqueQueue();

        q.enqueueAll([3, 1, 2]);
        q.enqueueAll([3, 2, 4]);

        expect(q.length).toBe(4);
        expect(q.dequeue()).toBe(3);
        expect(q.dequeue()).toBe(1);
        expect(q.dequeue()).toBe(2);
        expect(q.dequeue()).toBe(4);
    });

    it('can enqueueAll (2)', () => {
        const q = new UniqueQueue();

        q.enqueueAll([3, 1, 2]);
        q.dequeue();
        q.enqueueAll([3, 2, 4]);

        expect(q.length).toBe(4);
        expect(q.dequeue()).toBe(1);
        expect(q.dequeue()).toBe(2);
        expect(q.dequeue()).toBe(3);
        expect(q.dequeue()).toBe(4);
    });

    it('can enqueueAll (3)', () => {
        const q = new UniqueQueue();

        q.enqueueAll([3, 1, 3, 1, 3]);
        q.dequeue();
        q.dequeue();
        q.enqueueAll([3, 4, 1]);

        expect(q.length).toBe(3);
        expect(q.dequeue()).toBe(3);
        expect(q.dequeue()).toBe(4);
        expect(q.dequeue()).toBe(1);
    });


    it('can enqueueAll (4)', () => {
        const q = new UniqueQueue();

        q.enqueueAll([3, 1, 3, 1, 3]);
        q.dequeue();
        q.enqueueAll([3, 4, 1]);

        expect(q.length).toBe(3);
        expect(q.dequeue()).toBe(1);
        expect(q.dequeue()).toBe(3);
        expect(q.dequeue()).toBe(4);
    });

    it('can enqueueAll (5)', () => {
        const q = new UniqueQueue();

        q.enqueueAll([3, 1, 3, 1, 3]);
        q.dequeueMulti(2);
        q.enqueueAll([3, 4, 1]);

        expect(q.length).toBe(3);
        expect(q.dequeue()).toBe(3);
        expect(q.dequeue()).toBe(4);
        expect(q.dequeue()).toBe(1);
    });

    it('can remove', () => {
        const q = new UniqueQueue();
        q.enqueueAll([3, 1, 2, 4, 5]);
        q.remove(2);
        q.remove(3);
        q.remove(5);
        q.remove(9);
        expect(q.length).toBe(2);

        expect(q.dequeue()).toBe(1);
        expect(q.dequeue()).toBe(4);
    });
});
