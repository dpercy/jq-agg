{
	function foldPipe(head, tail) {
    	var result = head;
        tail.forEach(function(suffix) {
          result = {
              type: "Pipe",
              left: result,
              right: suffix,
          };
        });
        return result;
	}
    
    function mkCall(func, ...args) {
      return { type: "Call", function: func, arguments: args };
    }
}

Program = _ p:Pipeline _ { return p }

Pipeline = head:Stage tail:(_ "|" _ s:Stage { return s })* {
    return foldPipe(head, tail);
}

Stage = Prec0

Prec0
= lhs:Prec1 _ op:$("or") _ rhs:Prec1 { return mkCall(op, lhs, rhs) }
/ Prec1

Prec1
= lhs:Prec2 _ op:$("and") _ rhs:Prec2 { return mkCall(op, lhs, rhs) }
/ Prec2

Prec2
// NOTE: be careful with the ordered choice operator:
// ">=" must come before ">", etc!
= lhs:Prec3 _ op:$("=="/"!="/">="/"<="/">"/"<") _ rhs:Prec3 { return mkCall(op, lhs, rhs) }
/ Prec3

Prec3 = Primary


// Primary :=  foo  or  .bar  or   .blah[1:2][5].blerg
Primary = head:PrimaryHead tail:PrimaryTail* {
  	return foldPipe(head, tail);
}

PrimaryHead = "(" _ p:Pipeline _ ")" { return p }
          / v:(Number/String) { return {type:"Literal", value: v } }
          / FunctionCall
          / Array
          / Object
          / "." v:( FieldRef
                  / Subscript
                  / "" { return {type:"Noop"} }) { return v }
PrimaryTail = "." fr:FieldRef { return fr } / Subscript

// A zero-argument function is called with just its name,
// like `length`; never with empty parens, like `length()`.
FunctionCall = f:Identifier _ a:Args {
  return { type: "Call", function: f, arguments: a }
}
Args = "(" _ head:Pipeline tail:(_ ";" _ p:Pipeline { return p })* _ ")"
             { return [head].concat(tail) }
     / "" { return [] }
     
Array = "[" _ a:ArrayItems _ "]" { return { type: "Array", items: a } }
ArrayItems
// jq comma has higher precedence than pipe,
// so each array item is not a pipeline, it's a stage.
= head:Stage tail:(_ "," _ s:Stage { return s })* { return [head].concat(tail) }
/ "" { return [] }
     
Object = "{" _ o:ObjectFields _ "}" { return { type: "Object", fields: o } }
ObjectFields
= head:ObjectField tail:(_ "," _ f:ObjectField {return f})* {
    return [head].concat(tail)
}
/ "" { return [] }
ObjectField
= key:(Identifier / String) _ ":" _ value:Pipeline
    { return { key: key, value: value } }
/ key:(Identifier/String)
    { return { key: key, value: { type: "FieldRef", name: key } } }
     
Subscript
= "[" _ index:Number _ "]" { return { type: "Subscript", index: index } }
/ "[" _ start:Number _ ":" _ end:Number _ "]" { return { type: "Slice", start: start, end: end } }
/ "[" _ ":" _ end:Number _ "]" { return { type: "Slice", end: end } }
/ "[" _ start:Number _ ":" _ "]" { return { type: "Slice", start: start } }

// NOTE: this rule doesn't include the leading ".",
// because that has to be factored out in the StageHead rule,
// because PEGs don't support backtracking (IIUC).
FieldRef = x:(Identifier/String) {
  return { type: "FieldRef", name: x }
}

// tokens
Identifier = [_a-zA-Z][_a-zA-Z0-9]* { return text() }
String = '"' StringChar* '"' { return JSON.parse(text()) }
StringChar
= "\\" ( '"' { return '"' }
       / 'b' { return '\b' }
       / 'f' { return '\f' }
       / 'n' { return '\n' }
       / 'r' { return '\r' }
       / 't' { return '\t' }
       / '/' { return '/' }
       / '\\' { return '\\' })
/ [^"] { return text() }
Number "number" = n:[0-9]+ { return +text() }
_ "whitespace" = [ \t\n\r]*
