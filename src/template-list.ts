/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface CodeTemplate {
    /** Display name shown in the templates menu, also stored as the snippet name */
    name: string;
    /** File name inside `src/templates/`, copied to `app/templates/` at build time */
    path: string;
}

/**
 * Code templates offered in the templates menu.
 * A `.brs` file loads as a single source file, a `.zip` as a full project.
 */
export const templates: CodeTemplate[] = [
    { name: "Hello World (Draw2D)", path: "hello-world.brs" },
    { name: "Snake Game (Draw2D)", path: "snake-game.brs" },
    { name: "Ball Boing (Draw2D)", path: "ball-boing.brs" },
    { name: "Collisions (Draw2D)", path: "collisions.zip" },
    { name: "Hello World (SceneGraph)", path: "hello-world.zip" },
    { name: "Simple Task (SceneGraph)", path: "simple-task.zip" },
    { name: "Bounding Rect (SceneGraph)", path: "bounding-rect.zip" },
    { name: "Label List (SceneGraph)", path: "label-list.zip" },
    { name: "Markup Grid (SceneGraph)", path: "markup-grid.zip" },
    { name: "Keyboard Dlg (SceneGraph)", path: "keyboard-dialog.zip" },
    { name: "Video List (SceneGraph)", path: "video-list.zip" },
];
