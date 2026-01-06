/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IEditorManager {
    getValue(): string;
    setValue(value: string): void;
    setMode(mode: string): void;
    setTheme(theme: string): void;
    focus(): void;
    hasFocus(): boolean;
    setIndentationType(useSpaces: boolean): void;
    setIndentationSize(size: number): void;
    onDidChangeModelContent(callback: () => void): void;
    layout(): void;
    clearHistory(): void;
}
