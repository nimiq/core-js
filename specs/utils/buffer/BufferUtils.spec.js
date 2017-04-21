describe('BufferUtils', () => {

	it('has fromUnicode and toUnicode methods',() => {
		expect(BufferUtils.toUnicode(BufferUtils.fromUnicode('{x:"test"}'))(.toEqual('{x:"test"}');
	});
	
	it('has fromBase64 and toBase64 methods',() => {
		expect(BufferUtils.toBase64(BufferUtils.fromBase64('dGVzdA=='))).toEqual('dGVzdA==')
	});
	
	it('has an equals method',() => {
		const buffer1 = BufferUtils.fromUnicode('test1');
		const buffer2 = BufferUtils.fromUnicode('test2');
		const buffer3 = BufferUtils.fromUnicode('test3');
		
		expect(buffer1.equals(buffer2)).toEqual(true);
		expect(buffer1.equals(buffer3)).toEqual(false);
	});
});