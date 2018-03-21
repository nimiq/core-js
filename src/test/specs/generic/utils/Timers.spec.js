describe('Timers', () => {
    /** @type {Timers} */
    let timers;
    
    beforeEach(() => {
        if (timers) timers.clearAll();
        timers = new Timers();
    });
    
    it('can set timeout', (done) => {
        let invoked = false;
        timers.setTimeout('done', () => {
            invoked = true;
            done();
        }, 10);
        expect(invoked).toBeFalsy();
    });
    
    it('can cancel timeout', (done) => {
        let invoked = false;
        timers.setTimeout('done', () => {
            invoked = true;
        }, 10);
        timers.clearTimeout('done');
        setTimeout(() => {
            expect(invoked).toBeFalsy();
            done();
        }, 50);
    });

    it('can set interval', (done) => {
        let count = 0;
        timers.setInterval('done', () => {
            count++;
            if (count > 3) {
                expect(count).toBe(4);
                timers.clearInterval('done');
                done();
            }
        }, 10);
        expect(count).toBe(0);
    });

    it('can cancel interval', (done) => {
        let count = 0;
        timers.setInterval('done', () => {
            count++;
            if (count > 3) {
                timers.clearInterval('done');
                setTimeout(() => {
                    expect(count).toBe(4);
                    done();
                }, 50);
            }
        }, 10);
        expect(count).toBe(0);
    });
});
