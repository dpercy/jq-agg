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
        // .[start:end] -> $skip, $limit
        when(m.var('v', (v) => v.type === "Slice"), ({v}) => {
            var skip = 'start' in v ? [{$skip: v.start}] : [];
            var limit = 'end' in v ? [{$limit: v.end}] : [];
            // Always apply the limit before the skip:
            // for example: .[3:5] should limit to 5, then skip 3,
            // resulting in 2 returned array elements.
            return limit.concat(skip);
        })
        // select(predicate) -> {$match: predicate}
        when({
            type: "Call",
            function: "select",
            arguments: [ m.var('arg') ]
        }, ({arg}) => {
            return {$match: translatePredicate(arg)}
        })
        // group_by(.fieldName; { x: aggregate, ... }) -> {$group: {_id: "$fieldName", x: aggregate ... }}
        when({
            type: "Call",
            function: "group_by",
            arguments: [
                { type: "FieldRef", name: m.var('grouperField') },
                { type: "Object", fields: m.var('accumFields') }
            ]
        }, ({grouperField, accumFields}) => {
            var doc = { _id: "$" + grouperField };
            accumFields.forEach(({ key, value }) => {
                doc[key] = translateAccumExpression(value);
            });
            return {$group: doc};
        })
        // fallback: when no case matches, raise an error
        when(m.any, () => {
            throw Error("Don't know how to translate jq: "
                        + JSON.stringify(jqStage, null, 2));
        })
    });
}

function translatePredicate(jqPred) { // -> predicate doc, suitable for passing to $match
    var comparisonOps = {
        '==': "$eq",
        '!=': "$ne",
        '>': "$gt",
        '<': "$lt",
        '>=': "$gte",
        '<=': "$lte",
    };
    var opFlip = {
        '==': "==",
        '!=': "!=",
        '>': "<",
        '<': ">",
        '>=': "<=",
        '<=': ">=",
    };
    var logicalOps = {
        'and': '$and',
        'or': '$or',
    };
    var m = match;
    return match(jqPred, (when) => {
        // when compiling (literal op fieldRef),
        // just flip it around and let the other cases handle it
        when({
            type: "Call",
            function: m.var('op', op => op in opFlip),
            arguments: [
                m.var('lhs', { type: "Literal", value: m.var('v') }),
                m.var('rhs', { type: "FieldRef", name: m.var('fieldName') })
            ]
        }, ({op, lhs, rhs}) => {
            return translatePredicate({ type: "Call", function: opFlip[op], arguments: [rhs, lhs] })
        })
        // comparison ops
        when({
            type: "Call",
            function: m.var('op', op => op in comparisonOps),
            arguments: [
                { type: "FieldRef", name: m.var('fieldName') },
                { type: "Literal", value: m.var('v') }
            ]
        }, ({fieldName, op, v}) => {
            return { [fieldName]: {[comparisonOps[op]]: v} }
        })
        // logical ops
        when({
            type: "Call",
            function: m.var('op', op => op in logicalOps),
            arguments: [ m.var('lhs'), m.var('rhs') ]
        }, ({op, lhs, rhs}) => {
            return { [logicalOps[op]]: [ translatePredicate(lhs), translatePredicate(rhs) ] };
        })
        when(m.any, () => {
            throw Error("Don't know how to compile this predicate: "
                        + JSON.stringify(jqPred, null, 2));
        })
    });
}

function translateAccumExpression(jqAccumExpr) { // -> single expression for use in {$group: { ... x: _ ... }}
    // cases:
    // map( thing )  ->  {$push: thing}
    // map( thing ) | func -> {$func: thing}
    var accums = {
        "add": "$sum",
        "unique": "$addToSet",
        "max": "$max",
        "min": "$min",
        "avg": "$avg", // technically not in jq, but equivalent to (add/length).
        "first": "$first",
        "last": "$last",
    };
    var m = match;
    return match(jqAccumExpr, (when) => {
        when({
            type: "Call",
            function: "map",
            arguments: [ { type: "FieldRef", name: m.var('field') } ]
        }, ({field}) => {
            return {$push: "$" + field};
        })
        when({
            type: "Pipe",
            left: {
                type: "Call",
                function: "map",
                arguments: [ { type: "FieldRef", name: m.var('field') } ]
            },
            right: { type: "Call", function: m.var('accum', a => a in accums), arguments: [] },
        }, ({field, accum}) => {
            return {[accums[accum]]: "$" + field};
        })
        when(m.any, () => {
            throw Error("Don't know how to compile this accumulator expression: "
                        + JSON.stringify(jqAccumExpr, null, 2));
        })
    });
}


root.translator = {
    translate: translate
};

})(this);
