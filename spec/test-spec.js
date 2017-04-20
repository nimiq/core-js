describe('nimiq specs', function() {


    it('true is true', function() {
    	localStorage.setItem('nimiq',true);
    	let val = localStorage.getItem('nimiq');
        expect(true).toEqual(true);
    }); 

   
});