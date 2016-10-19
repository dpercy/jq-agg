

test: parser.gen.js
	mongo --nodb test.js

parser.gen.js: parser.pegjs
	./node_modules/pegjs/bin/pegjs  --format globals  --export-var parser  -o $@   $<
