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
assert.eq(
    jqCompile('map({_id: .x.y})'),
    [{$project: {_id: "$x.y"}}])


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

// skip and limit
assert.eq(
    jqCompile('.[:10]'),
    [ {$limit: 10} ])
assert.eq(
    jqCompile('.[3:]'),
    [ {$skip: 3} ])
assert.eq(
    jqCompile('.[3:10]'),
    [ {$limit: 10}, {$skip: 3} ])

// $match -> select
assert.eq(
    jqCompile('select(.x == 123)'),
    [ {$match: { x: {$eq: 123}}} ])
assert.eq(
    jqCompile('select(123 < .x)'),
    [ {$match: { x: {$gt: 123}}} ])
assert.eq(
    jqCompile('select(.x == 123 and .y >= 456)'),
    [ {$match: {$and: [{ x: {$eq: 123}}, {y:{$gte: 456}}]}} ])
// TODO more match predicates!

// $group
assert.eq(
    jqCompile('group_by(.state; {totalPop: map(.pop)|add})'),
    [ {$group: {_id: "$state", totalPop: {$sum:"$pop"}}} ])
assert.eq(
    jqCompile('group_by(.state; { foundingYears: map(.foundingYear)|unique, nicknames: map(.nickname) })'),
    [ {$group: {
            _id: "$state",
            foundingYears: {$addToSet:"$foundingYear"},
            nicknames: {$push:"$nickname"}
      }} ])

assert.eq(
    jqCompile('group_by({state, city}; {})'),
    [ {$group: {_id: {state: "$state", city: "$city"}}} ])
assert.eq(
    jqCompile('group_by(1; {})'),
    [ {$group: {_id: {$literal: 1}}} ])
// TODO unify {n: length} and $group.  maybe  {x: accumulator} === group_by(1, {x: accumulator})


// sorting
assert.eq(
    jqCompile('sort_by(.totalPop)'),
    [ {$sort: {totalPop: 1}} ])
// sorting backwards
// NOTE: This example is BROKEN when .totalPop is not a number:
// jq gives an error, but MongoDB will just use BSON compare.
assert.eq(
    jqCompile('sort_by(-.totalPop)'),
    [ {$sort: {totalPop: -1}} ])
// sorting by tuple
assert.eq(
    jqCompile('sort_by([.name, -.age])'),
    [ {$sort: {name: 1, age: -1}} ])



// complex queries
assert.eq(
    // "find the state with the highest population"
    // TODO: this is actually wrong!!! $sort + $limit:1  === [max_by(_)] in an array!
    jqCompile('group_by(.state; {totalPop: map(.pop)|add}) | max_by(.totalPop)'),
    [ {$group: {_id: "$state", totalPop: {$sum:"$pop"}}},
      // rely on $sort + $limit coalescence for efficiency:
      // https://docs.mongodb.com/v3.0/core/aggregation-pipeline-optimization/#sort-limit-coalescence
      {$sort: {totalPop: -1}},
      {$limit: 1}
    ])

// TODO $unwind as .[]

// TODO support parameterized queries: db.mycoll.jq('select(.x == $val)', { val: 123 })




/*
examples from Docs and University:
https://docs.mongodb.com/v3.0/tutorial/aggregation-zip-code-data-set/#return-states-with-populations-above-10-million

    db.zipcodes.aggregate( [
       { $group: { _id: "$state", totalPop: { $sum: "$pop" } } },
       { $match: { totalPop: { $gte: 10*1000*1000 } } }
    ] )



    jq -s 'group_by(.state)'  means   {$group: {_id: "$state", theactualvalue: {$push: "$$CURRENT"}}}

    {$group: {_id: "$state", avgx: {$avg: "$x"}}}

*/
