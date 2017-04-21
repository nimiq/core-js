describe('Buffer', () => {

	it('has writeUint8 and readUint8',() => {

		const value1 = 255;
		const value2 = 254;
		const value3 = 0;
		const value4 = 1;

		const buffer = new Buffer(4);
		buffer.writeUint8(value1);
		buffer.writeUint8(value2);
		buffer.writeUint8(value3);
		buffer.writeUint8(value4);

		expect(buffer.readUint8()).toEqual(value1);
		expect(buffer.readUint8()).toEqual(value2);
		expect(buffer.readUint8()).toEqual(value3);
		expect(buffer.readUint8()).toEqual(value4);
		
	});
	
});