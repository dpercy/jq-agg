var jqCompile = (function() {

load('parser.gen.js'); // assigns to this.parser.parse
load('translate.js'); // assigns to this.translator

function jqCompile(str) {
    var jq = this.parser.parse(str);
    var agg = this.translator.translate(jq);
    return agg;
}

function jq(jqQuery, aggOptions) {
    var agg = jqCompile(jqQuery);
    return this.aggregate(agg, aggOptions);
}
DBCollection.prototype.jq = jq;
Explainable.prototype.jq = jq;

return jqCompile;

})();
