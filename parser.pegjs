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
}

Pipeline = head:Stage tail:(_ "|" _ s:Stage { return s })* {
    return foldPipe(head, tail);
}

Stage = head:StageHead tail:StageTail* {
  	return foldPipe(head, tail);
}

StageHead = "(" _ p:Pipeline _ ")" { return p }
          / v:(Number/String) { return {type:"Literal", value: v } }
          / FunctionCall
          / Object
          / "." v:( FieldRef
                  / Subscript
                  / "" { return {type:"Noop"} }) { return v }
StageTail = "." fr:FieldRef { return fr } / Subscript

// A zero-argument function is called with just its name,
// like `length`; never with empty parens, like `length()`.
FunctionCall = f:Identifier _ a:Args {
  return { type: "Call", function: f, arguments: a }
}
Args = "(" _ head:Pipeline tail:(_ ";" _ p:Pipeline { return p })* _ ")"
             { return [head].concat(tail) }
     / "" { return [] }
     
Object = "{" _ o:ObjectFields _ "}" { return { type: "Object", fields: o } }
ObjectFields
= head:ObjectField tail:(_ "," _ f:ObjectField {return f})* {
    return [head].concat(tail)
}
/ "" { return { type: "Object", fields: [] } }
ObjectField
= key:(Identifier / String) _ ":" _ value:Pipeline
    { return { key: key, value: value } }
/ key:(Identifier/String)
    { return { key: key, value: { type: "FieldRef", name: key } } }
     
Subscript = "[" _ index:Number _ "]" {
  return { type: "Subscript", index: index };
}
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
