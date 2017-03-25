<?php
/*
  DSRS is a Dead-simple Relay Server written in php.

  It's purpose is to establish simple one-time p2p connections between two browsers.
  (What is intended to be used for WebRTC Signaling)

  It is designed to be dead-simple and robust. 
  - We use the most wide spread and simple platform: php   
  - We built upon protocol and platform standards:
    - HTTP `event-stream` and Browser's `EventSource` api  
    - php's native `apc_store` (to share memory between two users)

  More info:
    - EventSource: http://www.w3schools.com/html/html5_serversentevents.asp
    - EventSource: https://www.html5rocks.com/en/tutorials/eventsource/basics/
    - apc_store: http://php.net/manual/en/function.apc-store.php

  Security Model:
  - The data isn't verified at all; it is just about preventing DoS
  - there is a fixed number of buckets that can contain a single fixed length message
  - ips are statically hashed to a bucket 
  - messages must contain a proof-of-work to get published
      - "last block hash" is the hash of current content of all buckets
      - A proof of work grants the right to store some data in a certain bucket for x-seconds
          (where x is the "block time")

*/

define("MAX_BUCKETS", 200); // Should be as high as possible 
define("MAX_MSG_LEN", 1500); // Should be as low as possible
define("SERVER_SEED", "<< insert a random string here >>"); // Should be different for every server

header('Access-Control-Allow-Origin: *');

$ip = $_SERVER['REMOTE_ADDR'];

if(isset($_GET['msg'])){
  publish($_GET['msg'],$ip);
} else {
  readChannel();
}

function publish($msg,$ip){ // O(1)
  if(strlen($msg) > MAX_MSG_LEN) die;
  // TODO: verify the message's proof of work and difficulty for this channel
  $bucket = hashIP($ip);
  apc_store($bucket, $msg);
}

function hashIP($ip){ // O( len(ip) ) ~ O(1)
  return 'b-'.hexdec( substr(md5($ip.SERVER_SEED), 0, 15) ) % MAX_BUCKETS;
}

function readChannel(){ // O(MAX_BUCKETS) ~ O(1)
  header('Content-Type: text/event-stream');
  header('Cache-Control: no-cache');
  //sleep(3);   // Should correspond to "proof-of-work time"
  echo "id: 1\n";
  echo "retry: 5000\n"; // Polling time. Should be dynamic
  for ($i=0; $i < MAX_BUCKETS; $i++) { 
    $msg = apc_fetch('b-'.$i);
    if($msg){
          echo "data: $msg\n";
        }
  }

  echo PHP_EOL;
  ob_flush();
  flush();
}


?>