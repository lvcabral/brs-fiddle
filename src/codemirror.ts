import * as CodeMirror from "codemirror";
import "codemirror/addon/comment/comment.js";
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/edit/matchbrackets.js";
import { defineMode } from "./brightscript";

export class CodeMirrorManager {
    public editor: CodeMirror.Editor;

    config: CodeMirror.EditorConfiguration = {
        lineWrapping: true,
        theme: "vscode-dark",
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: true,
        electricChars: false,
        matchBrackets: true,
        autoCloseBrackets: "()[]{}``\"\"",
        mode: "brightscript",
    };

    // CTOR
    constructor(private readonly tagElement: HTMLTextAreaElement, theme: string) {
        defineMode(CodeMirror);
        this.config.theme = getCodeMirrorTheme(theme);
        this.editor = CodeMirror.fromTextArea(this.tagElement, this.config);
        this.editor.setOption("extraKeys", {
            "Ctrl-/": function (cm) {
                cm.toggleComment();
            },
        });
    }
}

export function getCodeMirrorTheme(theme: string): string {
    return theme === "light" ? "coda" : "vscode-dark";
}
