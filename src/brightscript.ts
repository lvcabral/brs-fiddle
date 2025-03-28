// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StringStream } from "codemirror";

/*
BrightScript Language Mode

https://developer.roku.com/docs/references/brightscript/language/brightscript-language-reference.md

*/

export function defineMode(CodeMirror: any) {
    CodeMirror.defineMode("brightscript", function (conf: any, parserConf: any) {
        const ERRORCLASS = "error";

        function wordRegexp(words: string[]) {
            return new RegExp(`^((${words.join(")|(")}))\\b`, "i");
        }

        const singleOperators = /^[+\-/*&\\^<>=]/;
        const doubleOperators = /^((<>)|(<=)|(>=)|(<<)|(>>))/;
        const singleDelimiters = /^[.,;:$%!#&@?]/;
        const brackets = /^[(){}[\]]/;
        const functions = /^[_A-Za-z]\w*(?=\()/;
        const identifiers = /^[_A-Za-z]\w*/;

        const openingKeywords = ["sub", "function"];
        const endKeywords = ["endsub", "endfunction"];

        const openingControl = ["while", "if", "for", "try"];
        const middleControl = [
            "catch",
            "continue for",
            "continue while",
            "else if",
            "elseif",
            "else",
            "exit for",
            "exit while",
            "to",
            "step",
            "in",
            "then",
            "each",
            "as",
            "return",
            "stop",
            "throw",
        ];
        const endControl = [
            "next",
            "endif",
            "end if",
            "endfor",
            "end for",
            "endwhile",
            "end while",
            "endtry",
            "end try",
        ];
        const wordOperators = wordRegexp(["and", "or", "not", "mod"]);
        const commonkeywords = ["dim", "print", "goto", "library"];
        const commontypes = [
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

        const atomWords = ["true", "false", "invalid"];
        const builtinFuncsWords = [
            "box",
            "createobject",
            "getglobalaa",
            "getlastruncompileerror",
            "getlastrunruntimeerror",
            "type",
            "copyfile",
            "createdirectory",
            "deletefile",
            "findmemberfunction",
            "formatdrive",
            "formatjson",
            "getinterface",
            "listdir",
            "matchfiles",
            "movefile",
            "parsejson",
            "readasciifile",
            "rebootsystem",
            "rungarbagecollector",
            "sleep",
            "strtoi",
            "uptime",
            "wait",
            "writeasciifile",
            "asc",
            "chr",
            "instr",
            "lcase",
            "left",
            "len",
            "mid",
            "right",
            "str",
            "stri",
            "string",
            "stringi",
            "substitute",
            "tr",
            "ucase",
            "val",
            "abs",
            "atn",
            "cdbl",
            "cint",
            "cos",
            "csng",
            "exp",
            "fix",
            "int",
            "log",
            "sgn",
            "sin",
            "sqr",
            "tan",
        ];
        const builtinConsts = ["LINE_NUM"];
        let builtinObjsWords = ["global", "m"];
        const knownElements = [
            "getdefaultfont",
            "clear",
            "push",
            "next",
            "replace",
            "write",
            "writeline",
            "close",
            "open",
            "state",
            "update",
            "addnew",
            "tostr",
            "toint",
        ];

        builtinObjsWords = builtinObjsWords.concat(builtinConsts);

        const keywords = wordRegexp(commonkeywords);
        const types = wordRegexp(commontypes);
        const atoms = wordRegexp(atomWords);
        const builtinFuncs = wordRegexp(builtinFuncsWords);
        const builtinObjs = wordRegexp(builtinObjsWords);
        const known = wordRegexp(knownElements);
        const stringPrefixes = '"';

        const opening = wordRegexp(openingKeywords);
        const closing = wordRegexp(endKeywords);
        const openingCtrl = wordRegexp(openingControl);
        const middleCtrl = wordRegexp(middleControl);
        const closingCtrl = wordRegexp(endControl);
        const doubleClosing = wordRegexp(["end"]);
        const doOpening = wordRegexp(["do"]);
        const noIndentWords = wordRegexp(["library"]);
        const comment = wordRegexp(["rem"]);

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

            const ch = stream.peek();
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
                stream.match(/^((&H)|(&O))?[0-9.]/i, false) &&
                !stream.match(/^((&H)|(&O))?[0-9.]+[a-z_]/i, false)
            ) {
                let floatLiteral = false;
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
                let intLiteral = false;
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

                return "control";
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
                return "keyword";
            }

            if (stream.match(functions)) {
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
            const singleline = delimiter.length == 1;
            const OUTCLASS = "string";

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
            let style = state.tokenize(stream, state);
            let current = stream.current();

            // Handle '.' connected identifiers
            if (current === ".") {
                style = state.tokenize(stream, state);

                current = stream.current();
                if (
                    (style &&
                        (style.substr(0, 8) === "variable" ||
                            style === "builtin" ||
                            style === "keyword")) ||
                    knownElements.indexOf(current.substring(1)) > -1
                ) {
                    if (style === "builtin" || style === "keyword") style = "variable";
                    if (knownElements.indexOf(current.substr(1)) > -1) style = "variable-2";

                    return style;
                } else {
                    return ERRORCLASS;
                }
            }

            return style;
        }

        const external = {
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
                let style = tokenLexer(stream, state);

                state.lastToken = { style: style, content: stream.current() };

                if (style === "space") style = null;

                return style;
            },

            indent: function (state: any, textAfter: string) {
                const trueText = textAfter.replace(/(^\s+)|(\s+$)/g, "");
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
