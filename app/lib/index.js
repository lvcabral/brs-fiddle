/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

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

let iframe = document.getElementById("output-iframe");
let iframeWin = iframe.contentWindow || iframe;
let consoleLogsContainer = document.getElementById("console-logs");
let consoleLogsEmpty = document.getElementById("console-logs-empty");
let panel = parent.document.getElementById("console-logs");

let animationDelay = -1;
iframeWin.console = {
    panel: panel,
    log: function (...m) {
        let tempId = Math.floor(Math.random() * 10000);
        let pre = parent.document.createElement("pre");
        let toggleSwitch = parent.document.createElement("input");
        let toggleSwitchLabel = parent.document.createElement("label");
        let logsWrapper = parent.document.createElement("div");
        animationDelay += 1;
        pre.setAttribute("class", "console-line-item");
        pre.style.setProperty("--animation-order", animationDelay);
        logsWrapper.setAttribute("class", "console-line-item-content");
        pre.appendChild(toggleSwitch);
        pre.appendChild(toggleSwitchLabel);
        pre.appendChild(logsWrapper);
        toggleSwitch.setAttribute("type", "checkbox");
        toggleSwitch.setAttribute("id", tempId);
        toggleSwitch.setAttribute("class", "console-line-item-switch");
        toggleSwitchLabel.setAttribute("for", tempId);
        m.forEach((mItem) => {
            var newSpan = document.createElement("span");
            newSpan.setAttribute("class", typeof mItem);
            newSpan.textContent +=
                typeof mItem === "object" ? JSON.stringify(mItem, null, 1) : mItem;
            logsWrapper.appendChild(newSpan);
        });
        pre.appendChild(logsWrapper);
        this.panel.append(pre);
    },
    error: function (m) {
        let pre = parent.document.createElement("pre");
        pre.setAttribute("class", "console-line-item error");
        pre.textContent = typeof m === "object" ? JSON.stringify(m, null, 2) : m;
        this.panel.append(pre);
    },
};

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
        autoCloseTags: true,
        autoCloseBrackets: true,
        electricChars: false,
        autofocus: true,
        mode: "vbscript",
    });
    // initializeHeader();
    const { height } = codeColumn.getBoundingClientRect();
    editor.setSize("100%", `${height - 60}px`);

    // Initialize Device Emulator
    if (displayCanvas) {
        brsEmu.initialize({ lowResolutionCanvas: false }, { debugToConsole: false, disableKeys: false });
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
        const rightRect = rightContainer.getBoundingClientRect();
        brsEmu.redraw(false, rightRect.width, Math.trunc(rightRect.height / 2), window.devicePixelRatio);
        // Subscribe to Emulator Events
        brsEmu.subscribe("app", (event, data) => {
            if (event === "debug") {
                if (data.level === "error") {
                    iframeWin.console.error(data.content);
                } else {
                    iframeWin.console.log(data.content);
                }
                scrollToBottom();
                if (!hasAnything("#console-logs")) {
                    consoleLogsEmpty.classList.add("active");
                } else {
                    consoleLogsEmpty.classList.remove("active");
                }
            }
        });
    }
}

function scrollToBottom() {
    const scrollHeight = consoleLogsContainer.scrollHeight;
    consoleLogsContainer.scrollTo({
        top: scrollHeight,
        left: 0,
        behavior: "smooth",
    });
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
    try {
        brsEmu.execute("main.brs", editor.getValue(), false);
    } catch (e) {
        console.log(e); // Check EvalError object
        iframeWin.console.error(`${e.name}: ${e.message}`);
        scrollToBottom();
    }
    if (!hasAnything("#console-logs")) {
        consoleLogsEmpty.classList.add("active");
    } else {
        consoleLogsEmpty.classList.remove("active");
    }
}

function clearAll() {
    brsEmu.terminate("EXIT_USER_NAV");
    consoleLogsContainer.replaceChildren();
    animationDelay = -1;
    consoleLogsEmpty.classList.add("active");
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
    if (isResizing) {
        const rightRect = rightContainer.getBoundingClientRect();
        brsEmu.redraw(false, rightRect.width, Math.trunc(rightRect.height / 2) - 10, window.devicePixelRatio);
    }
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

function hasAnything(selector) {
    return document.querySelector(selector).innerHTML.trim().length > 0;
}
