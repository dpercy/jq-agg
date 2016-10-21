# jq-agg

[jq](https://stedolan.github.io/jq/) is "like sed for JSON": it lets you explore and transform JSON easily, the way sed and grep do for text.  For example, this query finds the most populous US state that starts with the letter "A":
```
$ mongoexport -c zips | jq -s ' map(select(.state > "B")) | group_by(.state; {p: map(.pop)|add}) | max_by(.p) '
```

jq-agg lets you run this query directly in the mongo shell:
```
> db.zips.jq(' map(select(.state > "B")) | group_by(.state; {p: map(.pop)|add}) | max_by(.p) ')
```

Internally, the jq query is rewritten into a MongoDB aggregation query.  Like any agg query, you can explain it to see what indexes and pipeline stages it uses:
```
> db.zips.explain().jq(' map(select(.state > "B")) | group_by(.state; {p: map(.pop)|add}) | max_by(.p) ')
```

## Installation

Clone this repo and run `make install`.
