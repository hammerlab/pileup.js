all:
	npm run build

test:
	npm run test

server:
	scripts/cgi-server.py &
	npm run http-server
