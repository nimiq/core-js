document.addEventListener("DOMContentLoaded", _ => {
	const pathFrags = location.pathname.split('/');
	let title = pathFrags[pathFrags.length-2];
	if(pathFrags[pathFrags.length-1].indexOf('.html')!==-1)
		title += ': '+pathFrags[pathFrags.length-1].replace('.html','')
	document.title = title;
	const el = document.createElement('div');
	el.innerHTML = 
		`<style>
			body{
				padding: 5% 12%;
				background: teal;
				color: white;
				font-family: sans-serif;
			}
		</style>
		<h4>test suite</h4>
		<h1><i>${title}</i></h1>`;
	document.body.appendChild(el);
});
