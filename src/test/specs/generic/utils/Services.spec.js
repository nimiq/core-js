describe('Services', () => {

    it('is initialized to NONE if no parameters are passed to the constructor', () => {
        const services = new Services();
        expect(services.provided).toBe(Services.NONE);
        expect(services.accepted).toBe(Services.NONE);
    });

    it('is initialized correctly to the parameters that are passed to the constructor', () => {
        const services = new Services(Services.FULL, Services.FULL | Services.NANO);
        expect(services.provided).toBe(Services.FULL);
        expect(services.accepted).toBe(Services.FULL | Services.NANO);
    });

    it('has working getter and setter for provided services', () => {
        const services = new Services();
        services.provided = Services.LIGHT;
        expect(services.provided).toBe(Services.LIGHT);
    });

    it('has working getter and setter for accepted services', () => {
        const services = new Services();
        services.accepted = Services.FULL | Services.LIGHT | Services.NANO;
        expect(services.accepted).toBe(Services.FULL | Services.LIGHT | Services.NANO);
    });

    it('correctly identifies Full Nodes', () => {
        expect(Services.isFullNode(Services.FULL)).toBe(true);
        expect(Services.isFullNode(Services.LIGHT)).toBe(false);
        expect(Services.isFullNode(Services.NANO)).toBe(false);
    });

    it('correctly identifies Light Nodes', () => {
        expect(Services.isLightNode(Services.LIGHT)).toBe(true);
        expect(Services.isLightNode(Services.FULL)).toBe(false);
        expect(Services.isLightNode(Services.NANO)).toBe(false);
    });

    it('correctly identifies Nano Nodes', () => {
        expect(Services.isNanoNode(Services.NANO)).toBe(true);
        expect(Services.isNanoNode(Services.FULL)).toBe(false);
        expect(Services.isNanoNode(Services.LIGHT)).toBe(false);
    });
});
