describe('Observable', () => {
    it('can notify a single observer', (done) => {
        const observable = new Observable();
        observable.on('event', () => {
            done();
        });
        observable.fire('event');
    });
    
    it('can notify multiple observers', (done) => {
        const observable = new Observable();
        let notified1 = false;
        let notified2 = false;
        let count = 0;
        observable.on('event', () => {
            expect(notified1).toBeFalsy();
            notified1 = true;
            if (++count === 2) done();
        });
        observable.on('event', () => {
            expect(notified2).toBeFalsy();
            notified2 = true;
            if (++count === 2) done();
        });
        observable.fire('event');
    });

    it('can notify different observers for different events', (done) => {
        const observable = new Observable();
        let notified1 = false;
        let notified2 = false;
        observable.on('event-1', () => {
            expect(notified1).toBeFalsy();
            notified1 = true;
        });
        observable.on('event-2', () => {
            expect(notified1).toBeTruthy();
            expect(notified2).toBeFalsy();
            notified2 = true;
            done();
        });
        observable.fire('event-1');
        observable.fire('event-2');
    });

    it('can notify wildcard observers', () => {
        const observable = new Observable();
        let count = 0;
        observable.on(Observable.WILDCARD, () => {
            count++;
        });
        observable.fire('event-1');
        observable.fire('event-2');
        observable.fire('event-3');
        expect(count).toBe(3);
    });

    it('can deregister an observer', () => {
        const observable = new Observable();
        let notified = false;
        const h = observable.on('event', () => {
            expect(notified).toBeFalsy();
            notified = true;
        });
        observable.fire('event');
        expect(notified).toBeTruthy();
        observable.off('event', h);
        observable.fire('event');
    });

    it('catches exceptions thrown by observers', () => {
        const observable = new Observable();
        let notified = false;
        observable.on('event', () => {
            expect(notified).toBeFalsy();
            notified = true;
            throw new Error();
        });
        observable.fire('event');
        expect(notified).toBeTruthy();
    });
});
