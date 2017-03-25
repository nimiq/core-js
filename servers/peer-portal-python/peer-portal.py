from SimpleWebSocketServer import SimpleWebSocketServer, WebSocket
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import SocketServer, threading, os, time, ssl

clients = []
class SimpleWsServer(WebSocket):

    def handleMessage(self):
    	self.responded = self.data

    def handleConnected(self):
        self.responded = False
        clients.append(self)

    def handleClose(self):
        clients.pop()

class SimpleHTTPServer(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write('hello')
        
    def do_POST(self):
        data = self.rfile.read(int(self.headers['Content-Length']))
        wsClient = clients[0]
        wsClient.sendMessage(data)

        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.send_header('Access-Control-Allow-Origin', '*')
        while not wsClient.responded:
            time.sleep(1)
        self.end_headers()
        self.wfile.write(wsClient.responded)
        wsClient.responded = False

httpServer = HTTPServer(('0.0.0.0', 8080), SimpleHTTPServer)
websocketServer = SimpleWebSocketServer('localhost', 8000, SimpleWsServer)

print 'HTTP Server runs on port 8080. Forward this service to the internet'
thread = threading.Thread(target = httpServer.serve_forever)
thread.daemon = True;
thread.start()
print 'WebSocket Server runs on 8000. Connect with your local browser'
websocketServer.serveforever()