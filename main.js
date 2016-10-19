var jqCompile = (function() {

load('parser.gen.js'); // assigns to this.parser.parse
load('translate.js'); // assigns to this.translator

function jqCompile(str) {
    var jq = this.parser.parse(str);
    var agg = this.translator.translate(jq);
    return agg;
}

return jqCompile;

})();
