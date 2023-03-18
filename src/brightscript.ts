// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StringStream } from "codemirror";

/*
BrightScript Language Mode

https://developer.roku.com/en-gb/docs/references/brightscript/language/brightscript-language-reference.md

*/

export function defineMode(CodeMirror: any) {
    CodeMirror.defineMode("brightscript", function (conf: any, parserConf: any) {
        var ERRORCLASS = "error";

        function wordRegexp(words: string[]) {
            return new RegExp("^((" + words.join(")|(") + "))\\b", "i");
        }

        var singleOperators = new RegExp("^[\\+\\-\\*/&\\\\\\^<>=]");
        var doubleOperators = new RegExp("^((<>)|(<=)|(>=)|(<<)|(>>))");
        var singleDelimiters = new RegExp("^[\\.,:]");
        var brackets = new RegExp("^[\\(\\)\\[\\]\\{\\}]");
        var identifiers = new RegExp("^[A-Za-z][_A-Za-z0-9]*");

        var openingKeywords = ["sub", "function"];
        var endKeywords = ["endsub", "endfunction"];

        var openingControl = ["while", "if", "for"];
        var middleControl = [
            "else",
            "elseif",
            "to",
            "step",
            "in",
            "then",
            "each",
            "as",
            "return",
            "exit",
            "stop",
        ];
        var endControl = ["next", "endif", "endfor", "endwhile"];

        var wordOperators = wordRegexp(["and", "or", "not", "mod"]);
        var commonkeywords = ["dim", "print"];

        var commontypes = [
            "object",
            "dynamic",
            "boolean",
            "string",
            "integer",
            "longinteger",
            "double",
            "float",
            "void",
        ];

        //This list was from: http://msdn.microsoft.com/en-us/library/f8tbc79x(v=vs.84).aspx
        var atomWords = ["true", "false", "invalid"];
        //This list was from: http://msdn.microsoft.com/en-us/library/3ca8tfek(v=vs.84).aspx
        var builtinFuncsWords = [
            "abs",
            "array",
            "asc",
            "atn",
            "cbool",
            "cbyte",
            "ccur",
            "cdate",
            "cdbl",
            "chr",
            "cint",
            "clng",
            "cos",
            "csng",
            "cstr",
            "date",
            "dateadd",
            "datediff",
            "datepart",
            "dateserial",
            "datevalue",
            "day",
            "escape",
            "eval",
            "execute",
            "exp",
            "filter",
            "formatcurrency",
            "formatdatetime",
            "formatnumber",
            "formatpercent",
            "getlocale",
            "getobject",
            "getref",
            "hex",
            "hour",
            "inputbox",
            "instr",
            "instrrev",
            "int",
            "fix",
            "isarray",
            "isdate",
            "isempty",
            "isnull",
            "isnumeric",
            "isobject",
            "join",
            "lbound",
            "lcase",
            "left",
            "len",
            "loadpicture",
            "log",
            "ltrim",
            "rtrim",
            "trim",
            "maths",
            "mid",
            "minute",
            "month",
            "monthname",
            "msgbox",
            "now",
            "oct",
            "replace",
            "rgb",
            "right",
            "rnd",
            "round",
            "sleep",
            "rebootsystem",
            "scriptenginemajorversion",
            "scriptengineminorversion",
            "second",
            "setlocale",
            "sgn",
            "sin",
            "space",
            "split",
            "sqr",
            "strcomp",
            "string",
            "strreverse",
            "tan",
            "time",
            "timer",
            "timeserial",
            "timevalue",
            "typename",
            "ubound",
            "ucase",
            "unescape",
            "vartype",
            "weekday",
            "weekdayname",
            "year",
        ];

        //This list was from: http://msdn.microsoft.com/en-us/library/ydz4cfk3(v=vs.84).aspx
        var builtinConsts = [
            "vbEmpty",
            "vbNull",
            "vbInteger",
            "vbLong",
            "vbSingle",
            "vbDouble",
            "vbCurrency",
            "vbDate",
            "vbString",
            "vbObject",
            "vbError",
            "vbBoolean",
            "vbVariant",
            "vbDataObject",
            "vbDecimal",
            "vbByte",
            "vbArray",
        ];
        //This list was from: http://msdn.microsoft.com/en-us/library/hkc375ea(v=vs.84).aspx
        var builtinObjsWords = ["WScript", "err", "debug", "RegExp"];
        var knownProperties = [
            "description",
            "firstindex",
            "global",
            "helpcontext",
            "helpfile",
            "ignorecase",
            "length",
            "number",
            "pattern",
            "source",
            "value",
            "count",
        ];
        var knownMethods = [
            "clear",
            "execute",
            "raise",
            "push",
            "replace",
            "test",
            "write",
            "writeline",
            "close",
            "open",
            "state",
            "eof",
            "update",
            "addnew",
            "end",
            "createobject",
            "quit",
        ];

        var knownWords = knownMethods.concat(knownProperties);

        builtinObjsWords = builtinObjsWords.concat(builtinConsts);

        var keywords = wordRegexp(commonkeywords);
        var types = wordRegexp(commontypes);
        var atoms = wordRegexp(atomWords);
        var builtinFuncs = wordRegexp(builtinFuncsWords);
        var builtinObjs = wordRegexp(builtinObjsWords);
        var known = wordRegexp(knownWords);
        var stringPrefixes = '"';

        var opening = wordRegexp(openingKeywords);
        var closing = wordRegexp(endKeywords);
        var openingCtrl = wordRegexp(openingControl);
        var middleCtrl = wordRegexp(middleControl);
        var closingCtrl = wordRegexp(endControl);
        var doubleClosing = wordRegexp(["end"]);
        var doOpening = wordRegexp(["do"]);
        var noIndentWords = wordRegexp(["on error resume next", "exit"]);
        var comment = wordRegexp(["rem"]);

        function indent(_stream: StringStream, state: any) {
            state.currentIndent++;
        }

        function dedent(_stream: StringStream, state: any) {
            state.currentIndent--;
        }
        // tokenizers
        function tokenBase(stream: StringStream, state: any) {
            if (stream.eatSpace()) {
                return "space";
            }

            var ch = stream.peek();
            // Handle Comments
            if (ch === "'") {
                stream.skipToEnd();
                return "comment";
            }
            if (stream.match(comment)) {
                stream.skipToEnd();
                return "comment";
            }

            // Handle Number Literals
            if (
                stream.match(/^((&H)|(&O))?[0-9\.]/i, false) &&
                !stream.match(/^((&H)|(&O))?[0-9\.]+[a-z_]/i, false)
            ) {
                var floatLiteral = false;
                // Floats
                if (stream.match(/^\d*\.\d+/i)) {
                    floatLiteral = true;
                } else if (stream.match(/^\d+\.\d*/)) {
                    floatLiteral = true;
                } else if (stream.match(/^\.\d+/)) {
                    floatLiteral = true;
                }

                if (floatLiteral) {
                    // Float literals may be "imaginary"
                    stream.eat(/J/i);
                    return "number";
                }
                // Integers
                var intLiteral = false;
                // Hex
                if (stream.match(/^&H[0-9a-f]+/i)) {
                    intLiteral = true;
                }
                // Octal
                else if (stream.match(/^&O[0-7]+/i)) {
                    intLiteral = true;
                }
                // Decimal
                else if (stream.match(/^[1-9]\d*F?/)) {
                    // Decimal literals may be "imaginary"
                    stream.eat(/J/i);
                    // TODO - Can you have imaginary longs?
                    intLiteral = true;
                }
                // Zero by itself with no other piece of number.
                else if (stream.match(/^0(?![\dx])/i)) {
                    intLiteral = true;
                }
                if (intLiteral) {
                    // Integer literals may be "long"
                    stream.eat(/L/i);
                    return "number";
                }
            }

            // Handle Strings
            if (stream.match(stringPrefixes)) {
                state.tokenize = tokenStringFactory(stream.current());
                return state.tokenize(stream, state);
            }

            // Handle operators and Delimiters
            if (
                stream.match(doubleOperators) ||
                stream.match(singleOperators) ||
                stream.match(wordOperators)
            ) {
                return "operator";
            }
            if (stream.match(singleDelimiters)) {
                return null;
            }

            if (stream.match(brackets)) {
                return "bracket";
            }

            if (stream.match(noIndentWords)) {
                state.doInCurrentLine = true;

                return "keyword";
            }

            if (stream.match(doOpening)) {
                indent(stream, state);
                state.doInCurrentLine = true;

                return "keyword";
            }
            if (stream.match(opening)) {
                if (!state.doInCurrentLine) indent(stream, state);
                else state.doInCurrentLine = false;

                return "keyword";
            }

            if (stream.match(openingCtrl)) {
                if (!state.doInCurrentLine) indent(stream, state);
                else state.doInCurrentLine = false;

                return "control";
            }

            if (stream.match(middleCtrl)) {
                return "control";
            }

            if (stream.match(doubleClosing)) {
                if (stream.peek() === " ") {
                    stream.eatSpace();
                }
                let style = "keyword";
                let result = stream.match(openingCtrl, false);
                if (result) {
                    style = "control";
                }
                dedent(stream, state);
                dedent(stream, state);
                return style;
            }

            if (stream.match(closing)) {
                if (!state.doInCurrentLine) dedent(stream, state);
                else state.doInCurrentLine = false;

                return "keyword";
            }

            if (stream.match(closingCtrl)) {
                if (!state.doInCurrentLine) dedent(stream, state);
                else state.doInCurrentLine = false;

                return "control";
            }

            if (stream.match(types)) {
                return "type";
            }

            if (stream.match(keywords)) {
                return "keyword";
            }

            if (stream.match(atoms)) {
                return "atom";
            }

            if (stream.match(known)) {
                return "variable-2";
            }

            if (stream.match(builtinFuncs)) {
                return "builtin";
            }

            if (stream.match(builtinObjs)) {
                return "variable-2";
            }

            if (stream.match(identifiers)) {
                return "variable";
            }

            // Handle non-detected items
            stream.next();
            return ERRORCLASS;
        }

        function tokenStringFactory(delimiter: string) {
            var singleline = delimiter.length == 1;
            var OUTCLASS = "string";

            return function (stream: StringStream, state: any) {
                while (!stream.eol()) {
                    stream.eatWhile(/[^'"]/);
                    if (stream.match(delimiter)) {
                        state.tokenize = tokenBase;
                        return OUTCLASS;
                    } else {
                        stream.eat(/['"]/);
                    }
                }
                if (singleline) {
                    if (parserConf.singleLineStringErrors) {
                        return ERRORCLASS;
                    } else {
                        state.tokenize = tokenBase;
                    }
                }
                return OUTCLASS;
            };
        }

        function tokenLexer(stream: StringStream, state: any) {
            var style = state.tokenize(stream, state);
            var current = stream.current();

            // Handle '.' connected identifiers
            if (current === ".") {
                style = state.tokenize(stream, state);

                current = stream.current();
                if (
                    (style &&
                        (style.substr(0, 8) === "variable" ||
                            style === "builtin" ||
                            style === "keyword")) ||
                    knownWords.indexOf(current.substring(1)) > -1
                ) {
                    if (style === "builtin" || style === "keyword") style = "variable";
                    if (knownWords.indexOf(current.substr(1)) > -1) style = "variable-2";

                    return style;
                } else {
                    return ERRORCLASS;
                }
            }

            return style;
        }

        var external = {
            electricChars: "dDpPtTfFeE ",
            startState: function () {
                return {
                    tokenize: tokenBase,
                    lastToken: null,
                    currentIndent: 0,
                    nextLineIndent: 0,
                    doInCurrentLine: false,
                    ignoreKeyword: false,
                };
            },

            token: function (stream: StringStream, state: any) {
                if (stream.sol()) {
                    state.currentIndent += state.nextLineIndent;
                    state.nextLineIndent = 0;
                    state.doInCurrentLine = 0;
                }
                var style = tokenLexer(stream, state);

                state.lastToken = { style: style, content: stream.current() };

                if (style === "space") style = null;

                return style;
            },

            indent: function (state: any, textAfter: string) {
                var trueText = textAfter.replace(/^\s+|\s+$/g, "");
                if (
                    trueText.match(closing) ||
                    trueText.match(doubleClosing) ||
                    trueText.match(middleCtrl)
                )
                    return conf.indentUnit * (state.currentIndent - 1);
                if (state.currentIndent < 0) return 0;
                return state.currentIndent * conf.indentUnit;
            },

            lineComment: "'",
        };
        return external;
    });

    CodeMirror.defineMIME("text/brs", "brightscript");
}
