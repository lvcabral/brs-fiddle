import * as CodeMirror from "codemirror";
import "codemirror/addon/comment/comment.js";
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/edit/matchbrackets.js";
import "codemirror/mode/xml/xml.js";
import "codemirror/mode/properties/properties.js";
import { defineMode } from "./brightscript";
import { getOS } from "./util";


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
        const isMacOS = getOS() === "MacOS";
        this.config.theme = getCodeMirrorTheme(theme);
        this.editor = CodeMirror.fromTextArea(this.tagElement, this.config);
        const commentShortcut = isMacOS ? "Cmd-/" : "Ctrl-/";
        this.editor.setOption("extraKeys", {
            [commentShortcut]: function (cm) {
                cm.toggleComment();
            },
        });
    }

    setMode(mode: string) {
        this.editor.setOption("mode", mode);
    }
}

export function getCodeMirrorTheme(theme: string): string {
    return theme === "light" ? "coda" : "vscode-dark";
}
