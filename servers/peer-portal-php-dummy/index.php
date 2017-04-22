<?
header('Access-Control-Allow-Origin: *');

if(isset($_GET['msg']) && isset($_GET['recipient'])){
	$msg = $_GET['msg'];
	$recipient = $_GET['recipient'];
  	apc_store($recipient, $msg);
} else {
	header('Content-Type: text/event-stream');
  	header('Cache-Control: no-cache');
	$me = $_GET['me'];
	$msg = apc_fetch($me);
	if($msg){
	    echo "data: $msg\n";
	}

	$msg = apc_fetch('global');
	if($msg){
	    echo "data: $msg\n";
	}
}

?>