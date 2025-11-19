import * as CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "../themes/coda.css";
import "../themes/vscode-dark.css";
import "codemirror/addon/comment/comment.js";
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/edit/matchbrackets.js";
import "codemirror/mode/xml/xml.js";
import "codemirror/mode/properties/properties.js";
import { defineMode } from "./brightscript-codemirror";
import { getOS } from "../util";
import { IEditorManager } from "./types";

export class CodeMirrorManager implements IEditorManager {
    public editor: CodeMirror.Editor;

    config: CodeMirror.EditorConfiguration = {
        lineWrapping: true,
        theme: "vscode-dark",
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: false,
        electricChars: false,
        matchBrackets: true,
        autoCloseBrackets: "()[]{}``\"\"",
        mode: "brightscript",
    };

    // CTOR
    constructor(
        private readonly tagElement: HTMLTextAreaElement,
        theme: string,
        indentationType: "spaces" | "tabs" = "spaces",
        indentationSize: number = 4
    ) {
        defineMode(CodeMirror);
        const isMacOS = getOS() === "MacOS";
        this.config.theme = getCodeMirrorTheme(theme);
        this.config.indentUnit = indentationSize;
        this.config.indentWithTabs = indentationType === "tabs";
        this.editor = CodeMirror.fromTextArea(this.tagElement, this.config);
        const commentShortcut = isMacOS ? "Cmd-/" : "Ctrl-/";
        this.editor.setOption("extraKeys", {
            [commentShortcut]: function (cm) {
                cm.toggleComment();
            },
        });
        // Set explicit size and refresh to ensure proper rendering
        this.editor.setSize("100%", "100%");
        setTimeout(() => this.editor.refresh(), 0);
    }

    getValue(): string {
        return this.editor.getValue();
    }

    setValue(value: string): void {
        this.editor.setValue(value);
    }

    setMode(mode: string): void {
        this.editor.setOption("mode", mode);
    }

    setTheme(theme: string): void {
        this.editor.setOption("theme", getCodeMirrorTheme(theme));
    }

    focus(): void {
        this.editor.focus();
    }

    hasFocus(): boolean {
        return this.editor.hasFocus();
    }

    setIndentationType(useSpaces: boolean): void {
        this.editor.setOption("indentWithTabs", !useSpaces);
    }

    setIndentationSize(size: number): void {
        this.editor.setOption("indentUnit", size);
    }

    onDidChangeModelContent(callback: () => void): void {
        this.editor.on("change", callback);
    }
    layout(): void {
        this.editor.refresh();
    }

    clearHistory(): void {
        this.editor.clearHistory();
    }
}

export function getCodeMirrorTheme(theme: string): string {
    return theme === "light" ? "coda" : "vscode-dark";
}
