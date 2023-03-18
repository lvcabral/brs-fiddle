import * as CodeMirror from "codemirror";
// import 'codemirror/lib/codemirror.css';
import "codemirror/addon/comment/comment.js";
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/edit/matchbrackets.js";
import { defineMode } from "./brightscript";
// import 'styles/vscode-dark.css';

export class CodeMirrorManager {
    public editor: CodeMirror.Editor;

    config: CodeMirror.EditorConfiguration = {
        lineWrapping: true,
        theme: "vscode-dark",
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        mode: "brightscript",
    };

    // CTOR
    constructor(private readonly tagElement: HTMLTextAreaElement) {
        defineMode(CodeMirror);
        this.editor = CodeMirror.fromTextArea(this.tagElement, this.config);
        this.editor.setOption("extraKeys", {
            "Ctrl-/": function (cm) {
                cm.toggleComment();
            },
        });
    }
}
