/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as brsEmu from "brs-emu";
import Codec from "json-url";
import Toastify from "toastify-js";
import VanillaTerminal from "vanilla-terminal";
import { nanoid } from "nanoid";
import { getOS } from "./util";
import { CodeMirrorManager } from "./codemirror";

const codec = Codec("lzma");
const brsCodeField = document.getElementById("brsCode") as HTMLTextAreaElement;
const saveButton = document.querySelector("button.save") as HTMLButtonElement;
const runButton = document.querySelector("button.run") as HTMLButtonElement;
const clearAllButton = document.querySelector("button.clear-all") as HTMLButtonElement;
const breakButton = document.querySelector("button.break") as HTMLButtonElement;
const shareButton = document.querySelector("button.share") as HTMLButtonElement;
const layoutContainer = document.querySelector("main.editor");
const layoutSeparator = document.querySelector("div.layout-separator") as HTMLDivElement;
const codeColumn = document.querySelector("div.code") as HTMLDivElement;
const consoleColumn = document.querySelector("div.console") as HTMLDivElement;
const rightContainer = document.getElementById("right-container") as HTMLDivElement;
const displayCanvas = document.getElementById("display") as HTMLCanvasElement;
const prompt = "Brightscript Debugger";
const commands = {
    help: (terminal: any) => {
        brsEmu.debug("help");
    },
    version: (terminal: any) => {
        terminal.output(`<br />Brightscript Emulator v${brsEmu.getVersion()}<br />`);
    },
};
const terminal = new VanillaTerminal({
    welcome: "<span style='color: #2e71ff'>Brightscript Emulator Console</span>",
    container: "console-logs",
    commands: commands,
    prompt: prompt,
    ignoreBadCommand: true,
    autoFocus: false,
});
terminal.idle();

// Buttons Events
saveButton.addEventListener("click", saveCode);
runButton.addEventListener("click", runCode);
clearAllButton.addEventListener("click", clearAll);
breakButton.addEventListener("click", startDebug);
shareButton.addEventListener("click", shareCode);
layoutSeparator.addEventListener("mousedown", resizeColumn);

let currentChannel = { id: "", running: false };
let consoleLogsContainer = document.getElementById("console-logs") as HTMLDivElement;
let isResizing = false;
let editorManager: CodeMirrorManager;
let currentId = nanoid(10);

function main() {
    const OS = getOS();
    if (saveButton) {
        saveButton.getElementsByTagName("span")[0].innerText = OS === "MacOS" ? "CMD+S" : "CTRL+S";
    }
    if (runButton) {
        runButton.getElementsByTagName("span")[0].innerText = OS === "MacOS" ? "CMD+R" : "CTRL+R";
    }
    if (clearAllButton) {
        clearAllButton.getElementsByTagName("span")[0].innerText =
            OS === "MacOS" ? "CMD+L" : "CTRL+L";
    }
    if (breakButton) {
        breakButton.getElementsByTagName("span")[0].innerText =
            OS === "MacOS" ? "CTRL+C" : "CTRL+BREAK";
    }
    // Initialize the manager
    if (brsCodeField) {
        editorManager = new CodeMirrorManager(brsCodeField);
    }
    // initializeHeader();
    const { height } = codeColumn.getBoundingClientRect();
    editorManager.editor.setSize("100%", `${height - 40}px`);

    const shareToken = getParameterByName("code");
    if (shareToken) {
        getCodeFromToken(shareToken).then(function (data: any) {
            if (data && data.id && data.code) {
                localStorage.setItem(data.id, data.code);
                window.location.href = getBaseUrl() + "/?id=" + data.id;
            } else {
                window.location.href = getBaseUrl();
            }
        });
        return;
    }
    const id = getParameterByName("id");
    if (id) {
        const code = localStorage.getItem(id);
        if (code) {
            editorManager.editor.setValue(code);
            currentId = id;
            if (getParameterByName("saved")) {
                showToast("Code saved in your browser local storage!\nTo share it use the Share button.", 5000);
            }
        }
    }
    // Initialize Device Emulator
    if (displayCanvas) {
        const customKeys = new Map();
        customKeys.set("Home", "ignore");
        customKeys.set("Backspace", "ignore");
        customKeys.set("Delete", "ignore");
        customKeys.set("Control+KeyA", "ignore");
        customKeys.set("Control+KeyZ", "ignore");
        brsEmu.initialize({}, { debugToConsole: false, customKeys: customKeys });

        // Subscribe to Emulator Events
        brsEmu.subscribe("brsFiddle", (event: any, data: any) => {
            if (event === "loaded") {
                currentChannel = data;
                terminal.output(`<br />Starting Emulator...<br /><br />`);
                terminal.idle();
            } else if (event === "started") {
                currentChannel = data;
                console.info(`Started ${data.id}`);
            } else if (event === "debug") {
                if (data.level === "stop") {
                    terminal.output("<br />");
                    terminal.setPrompt();
                } else if (data.level === "continue") {
                    terminal.idle();
                } else if (data.level !== "beacon") {
                    let output = data.content.replace("<", "&lt;");
                    if (data.level === "print") {
                        const promptLen = `${prompt}> `.length;
                        if (output.slice(-promptLen) === `${prompt}> `) {
                            output = output.slice(0, output.length - promptLen);
                        }
                    } else if (data.level === "warning") {
                        output = "<span style='color: #d7ba7d;'>" + output + "</span>";
                    } else if (data.level === "error") {
                        output = "<span style='color: #e95449;'>" + output + "</span>";
                    }
                    terminal.output(`<pre>${output}</pre>`);
                }
                scrollToBottom();
            } else if (event === "closed" || event === "error") {
                currentChannel = data;
                console.info(`Execution terminated! ${event}: ${data}`);
                terminal.idle();
            }
        });

        // Resize the display canvas
        const rightRect = rightContainer.getBoundingClientRect();
        brsEmu.redraw(
            false,
            rightRect.width,
            Math.trunc(rightRect.height / 2),
            window.devicePixelRatio
        );

        // Handle console commands
        terminal.onInput((command: string, parameters: string[], handled: boolean) => {
            if (!handled) {
                brsEmu.debug(`${command} ${parameters.join(" ")}`);
            }
        });
    }
}

function scrollToBottom() {
    if (consoleLogsContainer.children.length) {
        const console = consoleLogsContainer.children[0];
        const scrollHeight = console.scrollHeight;
        console.scrollTo({
            top: scrollHeight,
            left: 0,
            behavior: "smooth",
        });
    }
}

function shareCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        const data = {
            id: currentId,
            code: editorManager.editor.getValue(),
        }
        getShareUrl(data).then(function (shareLink: string) {
            navigator.clipboard.writeText(shareLink);
            showToast("Share URL copied to clipboard");
        });
    } else {
        showToast("There is no Source Code to share", 3000, true);
    }
}

function saveCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        localStorage.setItem(currentId, code);
        window.location.href = `${getBaseUrl()}/?id=${currentId}&saved=1`;
    } else {
        showToast("There is no Source Code to save", 3000, true);
    }
}

function runCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        try {
            brsEmu.execute("main.brs", editorManager.editor.getValue(), false);
        } catch (e: any) {
            console.log(e); // Check EvalError object
            terminal.output(`${e.name}: ${e.message}`);
            scrollToBottom();
        }
    } else {
        showToast("There is no Source Code to run", 3000, true);
    }
}

function startDebug() {
    if (currentChannel.running) {
        brsEmu.debug("break");
    } else {
        showToast("There is nothing running to debug", 3000, true);
    }
}

function clearAll() {
    terminal.clear();
}

function hotKeys(event: KeyboardEvent) {
    const isMacOS = getOS() === "MacOS";
    if ((isMacOS && event.code === "KeyR" && event.metaKey) || (event.code === "KeyR" && event.ctrlKey)) {
        event.preventDefault();
        runCode();
    } else if ((isMacOS && event.code === "KeyS" && event.metaKey) || (event.code === "KeyS" && event.ctrlKey)) {
        event.preventDefault();
        saveCode();
    } else if ((isMacOS && event.code === "KeyL" && event.metaKey) || (event.code === "KeyL" && event.ctrlKey)) {
        event.preventDefault();
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
    if (isResizing) {
        const rightRect = rightContainer.getBoundingClientRect();
        brsEmu.redraw(
            false,
            rightRect.width,
            Math.trunc(rightRect.height / 2) - 10,
            window.devicePixelRatio
        );
    }
    isResizing = false;
}

function getParameterByName(name: string, url = window.location.href) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return "";
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function getCodeFromToken(token: string) {
    return codec.decompress(token).then(function (data: any[]) {
        const result = {
            id: data[0] ?? null,
            code: data[1] ?? "",
        };
        return result;
    });
}

function getShareUrl(suite: any) {
    if (!suite) {
        return Promise.resolve(null);
    }
    //compress the object
    var data = [suite.id, suite.code];
    return codec.compress(data).then(function (text: string) {
        return getBaseUrl() + "/?code=" + text;
    });
}

function getBaseUrl(): string {
    let url = window.location.origin + window.location.pathname;
    if (url.slice(-1) === "/") {
        url = url.slice(0, url.length - 1);
    }
    return url;
}

function showToast(message: string, duration = 3000, error = false) {
    Toastify({
        text: message,
        duration: duration,
        close: false,
        gravity: "bottom",
        position: "center",
        stopOnFocus: true,
        className: error ? "toastify-error" : "toastify-success",
    }).showToast();
}

window.addEventListener("load", main, false);
document.addEventListener("keydown", hotKeys, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);

