(function(root) {


var match = (function() {
    // eval(cat(file)) is similar to load(file), but it evaluates it in the current scope,
    // instead of the global scope.  This lets us mock things like `global`.
    global = undefined;
    module = {};
    eval(cat("node_modules/pattern-match/lib/match.js"));
    return module.exports;
})();



// input: a parsed jq expression (pipeline)
// output: a MongoDB agg pipeline (suitable for passing to 
function translate(jq) {
    return flattenPipeline(jq).map(translateStage);
}

// input: jq pipeline
// output: array of jq stages
function flattenPipeline(jq) {
    var result = [];
    (function recur(jq) {
        if (jq.type === 'Pipe') {
            recur(jq.left);
            recur(jq.right);
        } else {
            result.push(jq);
        }
    })(jq);
    return result;
}

function translateStage(jqStage) { // single agg stage
    var m = match;
    return match(jqStage, (when) => {
        // map({ key: value, ... }) -> {$project: {key: "$value", ...}}
        when({
            type: "Call",
            function: "map",
            arguments: [ {
                type: "Object",
                fields: m.var('fields'),
            } ]
        }, ({fields}) => {
            // further restrictions:
            // - each field value must be a literal or single field access
            var stage = {$project: {_id: 0}};
            fields.forEach((field) => match(field.value, (when) => {
                when({ type: "Literal", value: m.var('v') }, ({v}) =>
                    stage.$project[field.key] = {$literal: v})
                when({ type: "FieldRef", name: m.var('name') }, ({name}) =>
                    stage.$project[field.key] = "$" + name)
            }));
            return stage;
        })
        when(m.any, () => {
            throw Error("Don't know how to translate jq: "
                        + JSON.stringify(jqStage, null, 2));
        })
    });
}


root.translator = {
    translate: translate
};

})(this);
