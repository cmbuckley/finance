install:
	npm install

clean:
	rm -rf node_modules

test: mocha

mocha: install
	npm test

.PHONY: install clean test mocha
