load('main.js');

// Easiest case: a noop -> empty agg pipeline
assert.eq(
    jqCompile('.'),
    [])

// Simple $project with whitelist of fields
// - note _id is automatically projected out
assert.eq(
    jqCompile('map({x: "hello", y: 1})'),
    [{$project: {_id: 0, x: {$literal: "hello"}, y: {$literal: 1}}}])
assert.eq(
    jqCompile('map({x: .foo})'),
    [{$project: {_id: 0, x: "$foo"}}])
assert.eq(
    jqCompile('map({x})'),
    jqCompile('map({x: .x})'))
// TODO fix edge case: jq project missing field is null, agg project missing field is missing field!
// - edge case: when _id is specified, project it back in
assert.eq(
    jqCompile('map({_id: 1, x: .foo})'),
    [{$project: {_id: {$literal: 1}, x: "$foo"}}])
// TODO deeper project expressions are tricky because MongoDB has weird array behavior.
    //  - maybe I can generate an ugly agg query to hide this

// Simple $project with blacklist of fields
assert.eq(
    jqCompile('map(del(.x))'),
    [{$project: {x: 0}}])
assert.eq(
    jqCompile('map(del(.x))'),
    [{$project: {x: 0}}])

// `length` can't be expressed in agg because it doesn't return a document.
assert.throws(
    () => jqCompile('length'))
// Instead, you can write a project/length in jq and translate it as
// the MongoDB $group/$sum/1 pattern.
// (You also need to project out the unwanted _id: null field.)
assert.eq(
    jqCompile('{n: length}'),
    [ {$group: {_id: null, n: {$sum:1}}},
      {$project: {_id: 0}} ])
// TODO max is harder because its input is not an array of documents


// TODO $unwind as .[]
// TODO $match as select
// TODO skip and limit
// TODO sort
