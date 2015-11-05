install:
	npm install

clean:
	rm -rf node_modules

test: mocha

mocha:
	npm test

download:
	npm run download -- --from=$(from) --to=$(to)

.PHONY: install clean test mocha download
