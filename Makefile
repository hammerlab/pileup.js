all:
	npm run build

lint:
	npm run lint

test:
	npm run test

server:
	scripts/cgi-server.py &
	npm run http-server
