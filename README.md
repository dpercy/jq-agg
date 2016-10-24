# jq-agg

## Installation

Clone this repo and run `make`. (You also need `npm`: run `brew install npm` if you don't have it already.)

## What is it?

jq-agg lets you write filters in the "jq" language and execute them in MongoDB using the aggregation framework.

#### What is jq?

[jq](https://stedolan.github.io/jq/) is "like sed for JSON": it lets you explore and transform JSON easily, the way sed and grep do for text.  For example, this query finds the most populous US state that starts with the letter "A":
```
$ mongoexport -c zips | jq -s ' map(select(.state > "B")) | group_by(.state; {p: map(.pop)|add}) | max_by(.p) '
```

#### What does jq-agg do?

jq-agg lets you run jq queries directly in the mongo shell.  For example, you can run the previous query like this:
```
> db.zips.jq(' map(select(.state > "B")) | group_by(.state; {p: map(.pop)|add}) | max_by(.p) ')
```

Internally, the jq query is rewritten into a MongoDB aggregation query.  Like any agg query, you can explain it to see what indexes and pipeline stages it uses:
```
> db.zips.explain().jq(' map(select(.state > "B")) | group_by(.state; {p: map(.pop)|add}) | max_by(.p) ')
```
