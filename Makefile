all:
	npm run build
	cp dist/pileup.js* ~/web/pileup/lib

test:
	npm run test

server:
	scripts/cgi-server.py &
	npm run http-server
