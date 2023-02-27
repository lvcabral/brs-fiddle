/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// import * as brsEmu from "./brsEmu";
// import { CodeMirrorManager } from "./codemirror"

const brsCodeField = document.getElementById("brsCode");
const runButton = document.querySelector("button.run");
const runButtonEmpty = document.querySelector("button.run-empty");
const clearAllButton = document.querySelector("button.clear-all");
const shareButton = document.querySelector("button.share");
const layoutContainer = document.querySelector("main.editor");
const layoutSeparator = document.querySelector("div.layout-separator");
const codeColumn = document.querySelector("div.code");
const consoleColumn = document.querySelector("div.console");
const rightContainer = document.getElementById("right-container");
const displayCanvas = document.getElementById("display");

runButton.addEventListener("click", showPreview);
runButtonEmpty.addEventListener("click", showPreview);
clearAllButton.addEventListener("click", clearAll);
shareButton.addEventListener("click", share);
layoutSeparator.addEventListener("mousedown", resizeColumn);

let consoleLogsContainer = document.getElementById("console-logs");
let consoleLogsEmpty = document.getElementById("console-logs-empty");
let panel = parent.document.getElementById("console-logs");

let isResizing = false;
let editor;

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
    editor = CodeMirror.fromTextArea(brsCodeField, {
        lineWrapping: true,
        theme: "vscode-dark",
        styleActiveLine: true,
        lineNumbers: true,
        matchBrackets: true,
        indentUnit: 4,
        indentWithTabs: true,
        autoCloseTags: true,
        autoCloseBrackets: true,
        mode: "vbscript",
    });
    // initializeHeader();
    const { height } = codeColumn.getBoundingClientRect();
    editor.setSize("100%", `${height - 36}px`);

    // Initialize Device Emulator
    if (displayCanvas) {
        brsEmu.initialize({ lowResolutionCanvas: true }, { debugToConsole: true, disableKeys: true }, displayCanvas);
        // Subscribe to Events (optional)
        brsEmu.subscribe("myApp", (event, data) => {
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
    console.log(brsEmu.getVersion())
    brsEmu.execute("main.brs", editor.getValue(), false);
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

function hotKeys(e) {
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

function onMouseMove(e) {
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


const getOS = () => {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    let macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"];
    const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
    const iosPlatforms = ["iPhone", "iPad", "iPod"];
    let os = null;
    if (macosPlatforms.indexOf(platform) !== -1) {
      os = "MacOS";
    } else if (iosPlatforms.indexOf(platform) !== -1) {
      os = "iOS";
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
      os = "Windows";
    } else if (/Android/.test(userAgent)) {
      os = "Android";
    } else if (!os && /Linux/.test(platform)) {
      os = "Linux";
    }
    return os;
};
  