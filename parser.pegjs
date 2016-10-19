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
          / "." v:( FieldRef
                  / Subscript
                  / "" { return {type:"Noop"} }) { return v }
StageTail = "." fr:FieldRef { return fr } / Subscript

Subscript = "[" _ index:Number _ "]" {
  return { type: "Subscript", index: index };
}
FieldRef = x:Identifier {
  return { type: "FieldRef", name: x }
}

// tokens
Identifier = [_a-zA-Z][_a-zA-Z0-9]* { return text() }
Number "number" = n:[0-9]+ { return +text() }
_ "whitespace" = [ \t\n\r]*
