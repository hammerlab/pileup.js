#!/usr/bin/env python2

import sys
import BaseHTTPServer
import CGIHTTPServer
import cgitb; cgitb.enable()  ## This line enables CGI error reporting

PORT = 8082

server = BaseHTTPServer.HTTPServer
handler = CGIHTTPServer.CGIHTTPRequestHandler
server_address = ("", PORT)
handler.cgi_directories = ["/scripts"]

httpd = server (server_address, handler)
sys.stderr.write("CGI server listening on port %i\n" % PORT)
httpd.serve_forever()
