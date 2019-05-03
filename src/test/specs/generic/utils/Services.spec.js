describe('Services', () => {

    it('is initialized to NONE if no parameters are passed to the constructor', () => {
        const services = new Services();
        expect(services.provided).toBe(Services.NONE);
        expect(services.accepted).toBe(Services.NONE);
    });

    it('is initialized correctly to the parameters that are passed to the constructor', () => {
        const services = new Services(Services.FLAG_FULL, Services.FLAG_FULL | Services.FLAG_NANO);
        expect(services.provided).toBe(Services.FLAG_FULL);
        expect(services.accepted).toBe(Services.FLAG_FULL | Services.FLAG_NANO);
    });

    it('has working getter and setter for provided services', () => {
        const services = new Services();
        services.provided = Services.FLAG_LIGHT;
        expect(services.provided).toBe(Services.FLAG_LIGHT);
    });

    it('has working getter and setter for accepted services', () => {
        const services = new Services();
        services.accepted = Services.FLAG_FULL | Services.FLAG_LIGHT | Services.FLAG_NANO;
        expect(services.accepted).toBe(Services.FLAG_FULL | Services.FLAG_LIGHT | Services.FLAG_NANO);
    });

    it('correctly identifies Full Nodes', () => {
        expect(Services.isFullNode(Services.FLAG_FULL)).toBe(true);
        expect(Services.isFullNode(Services.FLAG_LIGHT)).toBe(false);
        expect(Services.isFullNode(Services.FLAG_NANO)).toBe(false);
    });

    it('correctly identifies Light Nodes', () => {
        expect(Services.isLightNode(Services.FLAG_LIGHT)).toBe(true);
        expect(Services.isLightNode(Services.FLAG_FULL)).toBe(false);
        expect(Services.isLightNode(Services.FLAG_NANO)).toBe(false);
    });

    it('correctly identifies Nano Nodes', () => {
        expect(Services.isNanoNode(Services.FLAG_NANO)).toBe(true);
        expect(Services.isNanoNode(Services.FLAG_FULL)).toBe(false);
        expect(Services.isNanoNode(Services.FLAG_LIGHT)).toBe(false);
    });

    it('correctly identifies provided features', () => {
        expect(Services.providesServices(Services.FLAG_FULL, Services.BLOCK_HISTORY, Services.TRANSACTION_INDEX, Services.BLOCK_PROOF)).toBe(true);
        expect(Services.providesServices(Services.FLAG_LIGHT, Services.ACCOUNTS_CHUNKS, Services.CHAIN_PROOF, Services.MEMPOOL, Services.ACCOUNTS_PROOF)).toBe(true);
        expect(Services.providesServices(Services.FLAG_NANO, Services.CHAIN_PROOF)).toBe(true);
    });
});
