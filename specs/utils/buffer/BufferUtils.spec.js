describe('BufferUtils', () => {

	it('has fromUnicode and toUnicode methods',() => {
		expect(BufferUtils.toUnicode(BufferUtils.fromUnicode('{x:"test"}'))).toEqual('{x:"test"}');
	});
	
	it('has fromBase64 and toBase64 methods',() => {
		expect(BufferUtils.toBase64(BufferUtils.fromBase64('dGVzdA=='))).toEqual('dGVzdA==')
	});
	
	it('has an equals method',() => {
		const buffer1 = BufferUtils.fromUnicode('test');
		const buffer2 = BufferUtils.fromUnicode('test');
		const buffer3 = BufferUtils.fromUnicode('test false');
		
		expect(BufferUtils.equals(buffer1,buffer2)).toEqual(true);
		expect(BufferUtils.equals(buffer1,buffer3)).toEqual(false);
	});
});