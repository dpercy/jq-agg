# This defines a function for JQ that makes grouping more convenient.
# It also makes grouping more similar to MongoDB's $group operator,
# which makes it easier to compile by special cases.
def group_by(grouper; mapper):
      group_by(grouper)
    | map( mapper as $v
         | (.[0]|grouper) as $id
         | {_id:$id} + $v
         )
;
# Example usage:
# cat ~/tmp/zips.json| jq -s 'include "./group_by2"; group_by(.state; {totalPop: map(.pop)|add})'

# You can also copy this file to ~/.jq to have group_by/2 always available.
