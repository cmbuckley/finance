install:
	npm install

clean:
	rm -rf node_modules

test: mocha

mocha:
	npm test

download:
	npm run casper -- --from=$(from) --to=$(to) --which=$(which)
	npm run monzo -- --from=$(from) --to=$(to)

.PHONY: install clean test mocha download
