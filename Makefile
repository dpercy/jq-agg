
parser.js: parser.pegjs
	./node_modules/pegjs/bin/pegjs  --format globals  --export-var parser  -o $@   $<
