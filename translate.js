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
    return flatten(flattenPipeline(jq).map(translateStage));
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

function flatten(v) {
    var result = [];
    (function recur(v) {
        if (Array.isArray(v)) {
            v.forEach(recur);
        } else {
            result.push(v);
        }
    })(v);
    return result;
}

function translateStage(jqStage) { // agg stage OR array of agg stages
    var m = match;
    return match(jqStage, (when) => {
        // jq noop -> empty agg pipeline
        when({ type: "Noop" }, () => [])
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
        // map(del(.fieldName)) -> {$project: {fieldName: 0}}
        when({
            type: "Call",
            function: "map",
            arguments: [ {
                type: "Call",
                function: "del",
                arguments: [ {
                    type: "FieldRef",
                    name: m.var('fieldName')
                } ]
            } ]
        }, ({fieldName}) => {
           return {$project: {[fieldName]: 0}};
        })
        // { n: length } -> {$group: {_id: null, n:{$sum:1}}}
        when({
            type: "Object",
            fields: [ {
                key: m.var('fieldName'),
                value: { type: "Call", function: "length", arguments: [] }
            } ]
        }, ({fieldName}) => {
            return [
                {$group: {_id: null, [fieldName]: {$sum:1}}},
                {$project: {_id: 0}}
            ];
        })
        // fallback: when no case matches, raise an error
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
