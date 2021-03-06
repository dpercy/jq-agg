

default: test install

.PHONY: install
install: bundle.gen.js
	cp bundle.gen.js ~/.mongo-jq-agg.js
	( [ -f ~/.mongorc.js ] && grep -q mongo-jq-agg ~/.mongorc.js ) || echo "load('$$HOME/.mongo-jq-agg.js')" >> ~/.mongorc.js 

.PHONY: test
test: bundle.gen.js parser.gen.js
	mongo --nodb test.js

bundle.gen.js: stub.js node_modules/pattern-match/lib/match.js parser.gen.js translate.js main.js 
	cat >$@ $^

parser.gen.js: parser.pegjs ./node_modules/pegjs/bin/pegjs
	./node_modules/pegjs/bin/pegjs  --format globals  --export-var parser  -o $@   $<

./node_modules/pegjs/bin/pegjs:
	npm install

.PHONY: clean
clean:
	rm -rf *.gen.js
