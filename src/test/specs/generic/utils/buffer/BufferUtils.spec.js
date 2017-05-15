describe('BufferUtils', () => {

	it('has fromUnicode and toUnicode methods',() => {
		expect(BufferUtils.toAscii(BufferUtils.fromAscii('{x:"test"}'))).toEqual('{x:"test"}');
	});
	
	it('has fromBase64 and toBase64 methods',() => {
		expect(BufferUtils.toBase64(BufferUtils.fromBase64('dGVzdA=='))).toEqual('dGVzdA==')
	});
	
	it('has an equals method',() => {
		const buffer1 = BufferUtils.fromAscii('test');
		const buffer2 = BufferUtils.fromAscii('test');
		const buffer3 = BufferUtils.fromAscii('test false');
		
		expect(BufferUtils.equals(buffer1,buffer2)).toEqual(true);
		expect(BufferUtils.equals(buffer1,buffer3)).toEqual(false);
	});


	it('can concat two Buffers',() => { 
		const buffer1 = BufferUtils.fromAscii('test1');
		const buffer2 = BufferUtils.fromAscii('test2');
		
		const concatedBuffer = BufferUtils.concat(buffer1,buffer2);
		const buffer3 = concatedBuffer.slice(0, buffer1.byteLength); 
		const buffer4 = concatedBuffer.slice(buffer1.byteLength);
		
		expect(BufferUtils.equals(buffer1,buffer3)).toEqual(true);
		expect(BufferUtils.equals(buffer2,buffer4)).toEqual(true);
	});
});