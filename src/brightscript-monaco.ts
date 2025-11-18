/*---------------------------------------------------------------------------------------------
 *  BrightScript Language Support for Monaco Editor
 *
 *  Based on the VS Code BrightScript Language Extension:
 *  https://github.com/rokucommunity/vscode-brightscript-language
 *
 *  Copyright (c) 2023-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as monaco from "monaco-editor";

/*
BrightScript Language Mode

Grammar converted from TextMate grammar in vscode-brightscript-language extension
https://github.com/rokucommunity/vscode-brightscript-language

*/

export function defineBrightScriptLanguage(monaco: typeof import("monaco-editor")) {
    // Register the language
    monaco.languages.register({ id: "brightscript" });

    // Set Monarch tokenizer (syntax highlighting)
    monaco.languages.setMonarchTokensProvider("brightscript", {
        defaultToken: "",
        ignoreCase: true,

        keywords: [
            "and", "as", "catch", "continue", "dim", "do", "each", "else", "elseif", "end", 
            "endfor", "endfunction", "endif", "endsub", "endtry", "endwhile", "eval", "exit", 
            "false", "for", "function", "goto", "if", "in", "invalid", "let", "library", 
            "loop", "mod", "next", "not", "or", "print", "rem", "return", "run", "step", 
            "stop", "sub", "then", "throw", "to", "true", "try", "while"
        ],

        typeKeywords: [
            "boolean", "integer", "longinteger", "float", "double", "string", "object", 
            "interface", "dynamic", "brsub", "void", "as"
        ],

        operators: ["=", ">=", "<=", "<", ">", "<>", "+", "-", "*", "/", "^", "\\", "&"],

        symbols: /[=><!~?:&|+\-*\/\^%]+/,

        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

        tokenizer: {
            root: [
                // Comments
                [/^\s*rem\b.*$/i, "comment"],
                [/'.*$/, "comment"],

                // Region markers
                [/^\s*'\s*#region/i, "comment.region"],
                [/^\s*'\s*#endregion/i, "comment.region"],

                // Preprocessor directives
                [/#\s*(const|if|elseif|else|endif|error)/i, "keyword.preprocessor"],

                // Template strings
                [/`/, { token: "string.backtick", bracket: "@open", next: "@templateString" }],

                // Double quoted strings
                [/"([^"\\]|\\.)*$/, "string.invalid"],
                [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

                // Hex numbers
                [/&H[0-9a-f]+/i, "number.hex"],

                // Octal numbers
                [/&O[0-7]+/i, "number.octal"],

                // Floats
                [/\d*\.\d+([eE][+-]?\d+)?[fFdD]?/, "number.float"],

                // Integers
                [/\d+[fFdDlL]?/, "number"],

                // Function/Sub declarations - MUST come before general keyword matching
                [/\bfunction\b/i, { token: "keyword", next: "@functionName" }],
                [/\bsub\b/i, { token: "keyword", next: "@subName" }],

                // End function/sub statements
                [/\b(end\s+function|endfunction)\b/i, "keyword"],
                [/\b(end\s+sub|endsub)\b/i, "keyword"],

                // Other end statements
                [/\b(end\s+if|endif)\b/i, "keyword"],
                [/\b(end\s+for|endfor)\b/i, "keyword"],
                [/\b(end\s+while|endwhile)\b/i, "keyword"],
                [/\b(end\s+try|endtry)\b/i, "keyword"],

                // Multi-word keywords
                [/\belse\s+if\b/i, "keyword"],
                [/\bend\s+if\b/i, "keyword"],
                [/\bend\s+for\b/i, "keyword"],
                [/\bend\s+while\b/i, "keyword"],
                [/\bend\s+sub\b/i, "keyword"],
                [/\bend\s+function\b/i, "keyword"],
                [/\bfor\s+each\b/i, "keyword"],
                [/\bexit\s+for\b/i, "keyword"],
                [/\bexit\s+while\b/i, "keyword"],
                [/\bcontinue\s+for\b/i, "keyword"],
                [/\bcontinue\s+while\b/i, "keyword"],

                // Keywords (function and sub are handled separately in declarations)
                [/\b(?:if|then|else|elseif|for|to|step|while|end|exit|return|as|next|stop|goto|dim|print|rem|new|try|catch|throw|run|library|continue|do|loop|each|in)\b/i, "keyword"],

                // Boolean and null constants
                [/\b(?:true|false)\b/i, "constant.language"],
                [/\b(?:invalid)\b/i, "constant.language"],

                // Special keywords
                [/\b(?:m|super|global)\b/i, "variable.language"],
                [/\bLINE_NUM\b/, "variable.language"],

                // Logical operators
                [/\b(?:and|or|not|mod)\b/i, "keyword.operator"],

                // Type keywords (function/sub as types only after 'as' keyword)
                [/(?<=\bas\s+)(function|sub)\b/i, "type"],
                
                // Other type keywords
                [/\b(?:boolean|integer|longinteger|float|double|string|object|interface|dynamic|brsub|void)\b/i, "type"],

                // Class, namespace, interface declarations
                [/\b(class|namespace|interface|enum)\s+([a-z_]\w*)/i, ["keyword", "type.identifier"]],

                // Roku built-in types (roXXX)
                [/\b(ro[A-Z]\w*)\b/, "type.roku"],

                // Function calls
                [/\b([a-z_]\w*)(?=\s*\()/i, "entity.name.function"],

                // Identifiers
                [/[a-z_]\w*/i, "identifier"],

                // Operators
                [/@symbols/, {
                    cases: {
                        "@operators": "operator",
                        "@default": ""
                    }
                }],

                // Delimiters and brackets
                [/[{}()\[\]]/, "@brackets"],
                [/[<>](?!@symbols)/, "@brackets"],
                [/[,;:.]/, "delimiter"],

                // Whitespace
                { include: "@whitespace" },
            ],

            whitespace: [
                [/\s+/, "white"],
            ],

            string: [
                [/[^\\"]+/, "string"],
                [/@escapes/, "string.escape"],
                [/\\./, "string.escape.invalid"],
                [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }]
            ],

            templateString: [
                [/\$\{/, { token: "delimiter.bracket", next: "@templateExpression" }],
                [/[^`$]+/, "string.backtick"],
                [/\$[^{]/, "string.backtick"],
                [/`/, { token: "string.backtick", bracket: "@close", next: "@pop" }]
            ],

            templateExpression: [
                [/\}/, { token: "delimiter.bracket", next: "@pop" }],
                { include: "root" }
            ],

            functionName: [
                [/\s+/, "white"],
                [/[a-z_]\w*/i, { token: "entity.name.function", next: "@pop" }],
                [/./, { token: "@rematch", next: "@pop" }]
            ],

            subName: [
                [/\s+/, "white"],
                [/[a-z_]\w*/i, { token: "entity.name.function", next: "@pop" }],
                [/./, { token: "@rematch", next: "@pop" }]
            ],
        },
    } as monaco.languages.IMonarchLanguage);

    // Set language configuration
    monaco.languages.setLanguageConfiguration("brightscript", {
        comments: {
            lineComment: "'",
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"],
        ],
        autoClosingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: '"', close: '"', notIn: ["string"] },
            { open: "`", close: "`", notIn: ["string", "comment"] },
        ],
        surroundingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: '"', close: '"' },
            { open: "`", close: "`" },
        ],
        folding: {
            markers: {
                start: /^\s*('|rem)\s*#region\b/i,
                end: /^\s*('|rem)\s*#endregion\b/i,
            },
        },
        onEnterRules: [
            {
                // Increase indent after function/sub declaration
                beforeText: /^\s*(?:function|sub)\s+\w+/i,
                action: { indentAction: monaco.languages.IndentAction.Indent },
            },
            {
                // Increase indent after if/for/while (without inline then)
                beforeText: /^\s*(?:if\b(?!.*\bthen\b.*$)|for\b|while\b|try\b)/i,
                action: { indentAction: monaco.languages.IndentAction.Indent },
            },
        ],
        indentationRules: {
            increaseIndentPattern: /^\s*(?:(?:function|sub)\s+\w+|(?:if\b(?!.*\bthen\b.*$))|(?:for\b)|(?:while\b)|(?:try\b)|(?:else\s*$))/i,
            decreaseIndentPattern: /^\s*(?:(?:end\s+(?:function|sub|if|for|while|try))|(?:endfunction|endsub|endif|endfor|endwhile|endtry)|(?:else\b)|(?:elseif\b)|(?:catch\b))/i,
        },
        wordPattern: /[a-zA-Z_]\w*/,
    });
}

