import * as CodeMirror from 'codemirror';
// import 'codemirror/lib/codemirror.css';
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/comment/comment.js";
import 'codemirror/mode/vbscript/vbscript.js';
// import 'styles/vscode-dark.css';

export class CodeMirrorManager {

    public editor: CodeMirror.Editor;

    config: CodeMirror.EditorConfiguration = {
        lineWrapping: true,
        theme: "vscode-dark",
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: false,
        mode: 'vbscript',
    };

    // CTOR
    constructor(private readonly tagElement: HTMLTextAreaElement) {
        this.editor = CodeMirror.fromTextArea(this.tagElement, this.config);
    }
}