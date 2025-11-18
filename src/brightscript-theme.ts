/*---------------------------------------------------------------------------------------------
 *  BrightScript Theme for Monaco Editor
 *
 *  Based on VS Code's default theme colors for BrightScript
 *  Matches the color scheme used in the VS Code BrightScript extension
 *
 *  Copyright (c) 2023-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as monaco from "monaco-editor";

/**
 * Defines BrightScript theme colors matching VS Code's default theme
 * These colors match the token colors used in the VS Code BrightScript extension
 */
export function defineBrightScriptTheme(monaco: typeof import("monaco-editor"), theme: string) {
    const isDark = theme === "dark";

    // VS Code Dark+ theme colors (default dark theme)
    const darkColors: monaco.editor.ITokenThemeRule[] = [
        // Keywords - blue (#569CD6 in VS Code Dark+)
        { token: "keyword", foreground: "569CD6" },
        { token: "keyword.operator", foreground: "569CD6" },
        { token: "keyword.preprocessor", foreground: "569CD6" },

        // Types - light blue/teal (#4EC9B0 in VS Code Dark+)
        { token: "type", foreground: "4EC9B0" },
        { token: "type.identifier", foreground: "4EC9B0" },
        { token: "type.roku", foreground: "4EC9B0" },

        // Strings - orange/brown (#CE9178 in VS Code Dark+)
        { token: "string", foreground: "CE9178" },
        { token: "string.quote", foreground: "CE9178" },
        { token: "string.backtick", foreground: "CE9178" },
        { token: "string.escape", foreground: "D7BA7D" },
        { token: "string.escape.invalid", foreground: "D7BA7D" },
        { token: "string.invalid", foreground: "F44747" },

        // Comments - green (#6A9955 in VS Code Dark+)
        { token: "comment", foreground: "6A9955" },
        { token: "comment.region", foreground: "6A9955" },

        // Numbers - light green (#B5CEA8 in VS Code Dark+)
        { token: "number", foreground: "B5CEA8" },
        { token: "number.hex", foreground: "B5CEA8" },
        { token: "number.octal", foreground: "B5CEA8" },
        { token: "number.float", foreground: "B5CEA8" },

        // Functions - yellow (#DCDCAA in VS Code Dark+)
        { token: "entity.name.function", foreground: "DCDCAA" },

        // Constants - blue (#569CD6 in VS Code Dark+)
        { token: "constant.language", foreground: "569CD6" },

        // Variables - light blue (#9CDCFE in VS Code Dark+)
        { token: "variable.language", foreground: "569CD6" },
        { token: "identifier", foreground: "9CDCFE" },

        // Operators - white/gray (#D4D4D4 in VS Code Dark+)
        { token: "operator", foreground: "D4D4D4" },

        // Delimiters - white/gray (#D4D4D4 in VS Code Dark+)
        { token: "delimiter", foreground: "D4D4D4" },
        { token: "delimiter.bracket", foreground: "FFD700" },
    ];

    // VS Code Light+ theme colors (default light theme)
    const lightColors: monaco.editor.ITokenThemeRule[] = [
        // Keywords - blue (#0000FF in VS Code Light+)
        { token: "keyword", foreground: "0000FF" },
        { token: "keyword.operator", foreground: "0000FF" },
        { token: "keyword.preprocessor", foreground: "0000FF" },

        // Types - teal (#267F99 in VS Code Light+)
        { token: "type", foreground: "267F99" },
        { token: "type.identifier", foreground: "267F99" },
        { token: "type.roku", foreground: "267F99" },

        // Strings - red/brown (#A31515 in VS Code Light+)
        { token: "string", foreground: "A31515" },
        { token: "string.quote", foreground: "A31515" },
        { token: "string.backtick", foreground: "A31515" },
        { token: "string.escape", foreground: "EE0000" },
        { token: "string.escape.invalid", foreground: "EE0000" },
        { token: "string.invalid", foreground: "CD3131" },

        // Comments - green (#008000 in VS Code Light+)
        { token: "comment", foreground: "008000" },
        { token: "comment.region", foreground: "008000" },

        // Numbers - dark green (#098658 in VS Code Light+)
        { token: "number", foreground: "098658" },
        { token: "number.hex", foreground: "098658" },
        { token: "number.octal", foreground: "098658" },
        { token: "number.float", foreground: "098658" },

        // Functions - brown (#795E26 in VS Code Light+)
        { token: "entity.name.function", foreground: "795E26" },

        // Constants - blue (#0000FF in VS Code Light+)
        { token: "constant.language", foreground: "0000FF" },

        // Variables - blue (#001080 in VS Code Light+)
        { token: "variable.language", foreground: "0000FF" },
        { token: "identifier", foreground: "001080" },

        // Operators - black (#000000 in VS Code Light+)
        { token: "operator", foreground: "000000" },

        // Delimiters - black (#000000 in VS Code Light+)
        { token: "delimiter", foreground: "000000" },
        { token: "delimiter.bracket", foreground: "AF00DB" },
    ];

    const colors = isDark ? darkColors : lightColors;
    const baseTheme = isDark ? "vs-dark" : "vs";
    const customThemeName = isDark ? "brightscript-dark" : "brightscript-light";

    // Define a custom theme that inherits from the base theme
    monaco.editor.defineTheme(customThemeName, {
        base: baseTheme,
        inherit: true,
        rules: colors,
        colors: {},
    });
    
    // Return the theme name so it can be set by the caller
    return customThemeName;
}
