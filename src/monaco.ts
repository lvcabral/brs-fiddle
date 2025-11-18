import * as monaco from "monaco-editor";
// Import Monaco Editor CSS
require("monaco-editor/min/vs/editor/editor.main.css");
import { getOS } from "./util";
import { defineBrightScriptLanguage } from "./brightscript-monaco";
import { defineBrightScriptTheme } from "./brightscript-theme";

// MonacoEnvironment is automatically configured by monaco-editor-webpack-plugin
// No manual configuration needed - webpack plugin handles web workers

export class MonacoManager {
    public editor: monaco.editor.IStandaloneCodeEditor;

    // CTOR
    constructor(private readonly containerElement: HTMLElement, theme: string) {
        // Register BrightScript language
        defineBrightScriptLanguage(monaco);
        
        // Define BrightScript theme matching VS Code colors and get the theme name
        const brightscriptTheme = defineBrightScriptTheme(monaco, theme);

        const isMacOS = getOS() === "MacOS";

        this.editor = monaco.editor.create(containerElement, {
            value: "",
            language: "brightscript",
            theme: brightscriptTheme,
            lineNumbers: "on",
            wordWrap: "on",
            tabSize: 4,
            insertSpaces: false, // Use tabs
            automaticLayout: true,
            minimap: {
                enabled: false,
            },
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: "monospace",
            autoIndent: "full",
            formatOnPaste: false,
            formatOnType: false,
        });

        // Add comment toggle shortcut
        const commentShortcut = isMacOS ? "Cmd-/" : "Ctrl-/";
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
            this.editor.getAction("editor.action.commentLine")?.run();
        });
    }

    setTheme(theme: string) {
        // Update BrightScript theme colors for the new theme and get the theme name
        const brightscriptTheme = defineBrightScriptTheme(monaco, theme);
        monaco.editor.setTheme(brightscriptTheme);
    }

    setMode(mode: string) {
        monaco.editor.setModelLanguage(this.editor.getModel()!, mode);
    }

    getValue(): string {
        return this.editor.getValue();
    }

    setValue(value: string) {
        this.editor.setValue(value);
    }

    focus() {
        this.editor.focus();
    }

    hasFocus(): boolean {
        return this.editor.hasTextFocus();
    }

    dispose() {
        this.editor.dispose();
    }
}

