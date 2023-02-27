/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Toastify from "toastify-js";
import { getOS } from "./util";
import * as brsEmu from "brs-emu";
import { CodeMirrorManager } from "./codemirror"

const brsCodeField = document.getElementById("brsCode") as HTMLTextAreaElement;
const runButton = document.querySelector("button.run") as HTMLButtonElement;
const runButtonEmpty = document.querySelector("button.run-empty") as HTMLButtonElement;
const clearAllButton = document.querySelector("button.clear-all") as HTMLButtonElement;
const shareButton = document.querySelector("button.share") as HTMLButtonElement;
const layoutContainer = document.querySelector("main.editor");
const layoutSeparator = document.querySelector("div.layout-separator") as HTMLDivElement;
const codeColumn = document.querySelector("div.code") as HTMLDivElement;
const consoleColumn = document.querySelector("div.console") as HTMLDivElement;
const rightContainer = document.getElementById("right-container") as HTMLDivElement;
const displayCanvas = document.getElementById("display") as HTMLCanvasElement;

runButton.addEventListener("click", showPreview);
runButtonEmpty.addEventListener("click", showPreview);
clearAllButton.addEventListener("click", clearAll);
shareButton.addEventListener("click", share);
layoutSeparator.addEventListener("mousedown", resizeColumn);

let consoleLogsContainer = document.getElementById("console-logs");
let consoleLogsEmpty = document.getElementById("console-logs-empty");
let panel = parent.document.getElementById("console-logs");

let isResizing = false;
let editorManager: CodeMirrorManager;

function main() {
    const OS = getOS();
    if (runButton) {
        runButton.getElementsByTagName("span")[0].innerText =
            OS === "MacOS" ? "CMD+R" : "CTRL+R";
    }
    if (clearAllButton) {
        clearAllButton.getElementsByTagName("span")[0].innerText =
            OS === "MacOS" ? "CMD+L" : "CTRL+L";
    }
    // Initialize the manager
    if (brsCodeField) {
        editorManager = new CodeMirrorManager(brsCodeField);
    }   
    // initializeHeader();
    const { height } = codeColumn.getBoundingClientRect();
    editorManager.editor.setSize("100%", `${height - 36}px`);

    // Initialize Device Emulator
    if (displayCanvas) {
        brsEmu.initialize({ lowResolutionCanvas: true }, { debugToConsole: true, disableKeys: true }, displayCanvas);
        // Subscribe to Events (optional)
        brsEmu.subscribe("myApp", (event: any, data: any) => {
            if (event === "loaded") {
                console.info(`Source code loaded: ${data.id}`);
            } else if (event === "started") {
                console.info(`Source code executing: ${data.id}`);
            } else if (event === "closed" || event === "error") {
                console.info(`Execution terminated! ${event}: ${data}`);
            }
        });
        console.log(brsEmu.getVersion())
    }
}

function share() {
    navigator.clipboard.writeText(window.location.href);
    Toastify({
        text: "Share URL copied to clipboard",
        duration: 3000,
        close: true,
        gravity: "bottom",
        position: "right",
        stopOnFocus: true,
        className: "toastify-success",
    }).showToast();
}

function showPreview() {
    var jsCode = editorManager.editor.getValue();
    brsEmu.execute("main.brs", jsCode, false);
    // if (!hasAnything("#console-logs")) {
    //     consoleLogsEmpty.classList.add("active");
    // } else {
    //     consoleLogsEmpty.classList.remove("active");
    // }
}

function clearAll() {
    // consoleLogsContainer.replaceChildren();
    // animationDelay = -1;
    // consoleLogsEmpty.classList.add("active");
}

function hotKeys(e: any) {
    let windowEvent = window ? window.event : e;
    if (
        (windowEvent.keyCode === 82 && windowEvent.metaKey) ||
        (windowEvent.keyCode === 82 && windowEvent.ctrlKey)
    ) {
        e.preventDefault();
        showPreview();
    }
    if (windowEvent.keyCode === 76 && windowEvent.metaKey) {
        e.preventDefault();
        clearAll();
    }
}

function resizeColumn() {
    isResizing = true;
}

function onMouseMove(e: any) {
    if (!isResizing) {
        return;
    }
    if (layoutContainer && rightContainer && codeColumn && consoleColumn) {
        const { x, width } = layoutContainer.getBoundingClientRect();
        const separatorPosition = width - (e.clientX - x);
        const codeColumnWidth = `${width - separatorPosition}px`;

        const rightRect = rightContainer.getBoundingClientRect();
        if (width - separatorPosition >= 420 && separatorPosition >= 360) {
            codeColumn.style.width = codeColumnWidth;
            consoleColumn.style.width = rightRect.width.toString();
        }

    }
}

function onMouseUp() {
    isResizing = false;
}

window.addEventListener("load", main, false);
window.addEventListener("keydown", hotKeys, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);
