/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as brs from "brs-engine";
import Codec from "json-url";
import Toastify from "toastify-js";
import VanillaTerminal from "vanilla-terminal";
import { nanoid } from "nanoid";
import { getOS } from "./util";
import { CodeMirrorManager } from "./codemirror";

const isMacOS = getOS() === "MacOS";
const codec = Codec("lzma");
const brsCodeField = document.getElementById("brsCode") as HTMLTextAreaElement;
const saveButton = document.querySelector("button.save") as HTMLButtonElement;
const deleteButton = document.querySelector("button.delete") as HTMLButtonElement;
const runButton = document.querySelector("button.run") as HTMLButtonElement;
const clearAllButton = document.querySelector("button.clear-all") as HTMLButtonElement;
const breakButton = document.querySelector("button.break") as HTMLButtonElement;
const endButton = document.querySelector("button.end") as HTMLButtonElement;
const shareButton = document.querySelector("button.share") as HTMLButtonElement;
const layoutContainer = document.querySelector("main.editor");
const layoutSeparator = document.querySelector("div.layout-separator") as HTMLDivElement;
const codeColumn = document.querySelector("div.code") as HTMLDivElement;
const consoleColumn = document.querySelector("div.console") as HTMLDivElement;
const rightContainer = document.getElementById("right-container") as HTMLDivElement;
const displayCanvas = document.getElementById("display") as HTMLCanvasElement;
const keyboardSwitch = document.getElementById("keyboard") as HTMLInputElement;
const gamePadSwitch = document.getElementById("gamepad") as HTMLInputElement;
const audioSwitch = document.getElementById("audioSwitch") as HTMLInputElement;
const audioIcon = document.getElementById("audio-icon") as HTMLElement;
const codeSelect = document.getElementById("code-selector") as HTMLSelectElement;
const codeDialog = document.getElementById("code-dialog") as HTMLDialogElement;
const codeForm = document.getElementById("code-form") as HTMLFormElement;
const deleteDialog = document.getElementById("delete-dialog") as HTMLDialogElement;

const prompt = "Brightscript Debugger";
const appId = "brsFiddle";
const commands = {
    help: (terminal: any) => {
        brs.debug("help");
    },
    version: (terminal: any) => {
        terminal.output(`<br />BrightScript Simulation Engine v${brs.getVersion()}<br />`);
    },
};
const terminal = new VanillaTerminal({
    welcome: `<span style='color: #2e71ff'>BrightScript Console - brs-engine v${brs.getVersion()}</span>`,
    container: "console-logs",
    commands: commands,
    prompt: prompt,
    ignoreBadCommand: true,
    autoFocus: false,
});
terminal.idle();

// Buttons Events
saveButton.addEventListener("click", saveCode);
deleteButton.addEventListener("click", deleteCode);
runButton.addEventListener("click", runCode);
clearAllButton.addEventListener("click", clearTerminal);
breakButton.addEventListener("click", startDebug);
endButton.addEventListener("click", endExecution);
shareButton.addEventListener("click", shareCode);
layoutSeparator.addEventListener("mousedown", resizeColumn);

let currentChannel = { id: "", running: false };
let consoleLogsContainer = document.getElementById("console-logs") as HTMLDivElement;
let isResizing = false;
let editorManager: CodeMirrorManager;
let currentId = nanoid(10);

function main() {
    if (saveButton) {
        saveButton.title = isMacOS ? "CMD+S" : "CTRL+S";
    }
    if (runButton) {
        runButton.title = isMacOS ? "CMD+R" : "CTRL+R";
    }
    if (clearAllButton) {
        clearAllButton.title = isMacOS ? "CMD+L" : "CTRL+L";
    }
    if (endButton) {
        endButton.title = isMacOS ? "CTRL+ESC" : "HOME";
    }
    if (breakButton) {
        breakButton.title = isMacOS ? "CTRL+C" : "CTRL+B";
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
            if (data?.id && data?.code) {
                localStorage.setItem(data.id, data.code);
                window.location.href = `${getBaseUrl()}?id=${data.id}`;
            } else {
                window.location.href = getBaseUrl();
            }
        });
        return;
    }
    const id = getParameterByName("id");
    populateCodeSelector(id ?? "");
    if (id) {
        loadCode(id);
    }
    // Initialize Device Simulator
    if (displayCanvas) {
        brs.initialize(
            { developerId: appId },
            {
                debugToConsole: false,
                disableKeys: !keyboardSwitch.checked,
                disableGamePads: !gamePadSwitch.checked,
            }
        );

        // Subscribe to Engine Events
        brs.subscribe(appId, (event: any, data: any) => {
            if (event === "loaded") {
                currentChannel = data;
                terminal.output(`<br />Executing source code...<br /><br />`);
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
                    let output = data.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    if (data.level === "print") {
                        const promptLen = `${prompt}&gt; `.length;
                        if (output.slice(-promptLen) === `${prompt}&gt; `) {
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
        brs.redraw(
            false,
            rightRect.width,
            Math.trunc(rightRect.height / 2),
            window.devicePixelRatio
        );

        // Handle console commands
        terminal.onInput((command: string, parameters: string[], handled: boolean) => {
            if (!handled) {
                brs.debug(`${command} ${parameters.join(" ")}`);
            }
        });
    }
}

function scrollToBottom() {
    if (consoleLogsContainer.children.length) {
        const terminal = consoleLogsContainer.children[0];
        const scrollHeight = terminal.scrollHeight;
        terminal.scrollTo({
            top: scrollHeight,
            left: 0,
            behavior: "auto",
        });
    }
}

function populateCodeSelector(currentId: string) {
    var arrCode = new Array();
    for (var i = 0; i < localStorage.length; i++) {
        const codeId = localStorage.key(i);
        if (codeId && !codeId.startsWith("VanillaTerm") && !codeId.startsWith(appId)) {
            let idx = arrCode.length;
            arrCode.push([]);
            let codeName = `Code #${i + 1}`;
            const code = localStorage.getItem(codeId);
            if (code?.startsWith("@=")) {
                codeName = code.substring(2, code.indexOf("=@"));
            }
            arrCode[idx][0] = codeName;
            arrCode[idx][1] = codeId;
        }
    }
    arrCode.sort();

    codeSelect.length = 1;
    for (var i = 0; i < arrCode.length; i++) {
        const codeId = arrCode[i][1];
        const selected = codeId === currentId;
        codeSelect.options[i + 1] = new Option(arrCode[i][0], codeId, false, selected);
    }

    deleteButton.style.visibility = currentId === "" ? "hidden" : "visible";
}

codeSelect.addEventListener("change", (e) => {
    if (codeSelect.value !== "0") {
        loadCode(codeSelect.value);
    } else {
        currentId = nanoid(10);
        resetApp();
    }
});

function loadCode(id: string) {
    let code = localStorage.getItem(id);
    if (code) {
        currentId = id;
        if (code.startsWith("@=")) {
            code = code.substring(code.indexOf("=@") + 2);
        }
        resetApp(id, code);
    } else {
        showToast("Could not find the code in the Local Storage!", 3000, true);
    }
}

function deleteCode() {
    if (currentId && localStorage.getItem(currentId)) {
        deleteDialog.showModal();
    } else {
        showToast("There is no Source Code to delete!", 3000, true);
    }
}

deleteDialog.addEventListener("close", (e) => {
    if (deleteDialog.returnValue === "ok") {
        localStorage.removeItem(currentId);
        currentId = nanoid(10);
        resetApp();
        showToast("Code deleted from your browser local storage!", 3000);
    }
    deleteDialog.returnValue = "";
});

function resetApp(id = "", code = "") {
    populateCodeSelector(id);
    if (currentChannel.running) {
        brs.terminate("EXIT_USER_NAV");
        clearTerminal();
    }
    const ctx = displayCanvas.getContext("2d", { alpha: false });
    ctx?.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    editorManager.editor.setValue(code);
    editorManager.editor.focus();
}

function shareCode() {
    let code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        if (codeSelect.value !== "0") {
            let codeName = codeSelect.options[codeSelect.selectedIndex].text;
            code = `@=${codeName}=@${code}`;
        }
        const data = {
            id: currentId,
            code: code,
        };
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
        if (codeSelect.value === "0") {
            codeDialog.showModal();
        } else {
            const codeName = codeSelect.options[codeSelect.selectedIndex].text;
            localStorage.setItem(currentId, `@=${codeName}=@${code}`);
            showToast(
                "Code saved in your browser local storage!\nTo share it use the Share button.",
                5000
            );
        }
    } else {
        showToast("There is no Source Code to save", 3000, true);
    }
}

codeDialog.addEventListener("close", (e) => {
    if (codeDialog.returnValue === "ok") {
        console.log("Name is ", codeForm.codeName.value);
        if (codeForm.codeName.value.trim().length >= 3) {
            const codeName = codeForm.codeName.value.trim();
            const code = editorManager.editor.getValue();
            localStorage.setItem(currentId, `@=${codeName}=@${code}`);
            populateCodeSelector(currentId);
            showToast(
                "Code saved in your browser local storage!\nTo share it use the Share button.",
                5000
            );
        } else {
            showToast("Code Snippet Name must have least 3 characters!", 3000, true);
        }
    }
    codeDialog.returnValue = "";
    codeForm.codeName.value = "";
});

function runCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        try {
            brs.execute(appId, editorManager.editor.getValue(), {
                clearDisplayOnExit: false,
                debugOnCrash: true,
                muteSound: !audioSwitch.checked,
            });
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
        brs.debug("break");
    } else {
        showToast("There is nothing running to debug", 3000, true);
    }
}

function endExecution() {
    if (currentChannel.running) {
        brs.terminate("EXIT_USER_NAV");
    } else {
        showToast("There is nothing running to terminate", 3000, true);
    }
}

function clearTerminal() {
    terminal.clear();
}

audioSwitch.addEventListener("click", (e) => {
    audioIcon.className = audioSwitch.checked ? "icon-sound-on" : "icon-sound-off";
    brs.setAudioMute(!audioSwitch.checked);
});

keyboardSwitch.addEventListener("click", controlModeSwitch);
gamePadSwitch.addEventListener("click", controlModeSwitch);

function controlModeSwitch() {
    brs.setControlMode({
        keyboard: keyboardSwitch.checked,
        gamePads: gamePadSwitch.checked,
    });
}

function hotKeys(event: KeyboardEvent) {
    if (
        (isMacOS && event.code === "KeyR" && event.metaKey) ||
        (event.code === "KeyR" && event.ctrlKey)
    ) {
        event.preventDefault();
        runCode();
    } else if (
        (isMacOS && event.code === "KeyS" && event.metaKey) ||
        (event.code === "KeyS" && event.ctrlKey)
    ) {
        event.preventDefault();
        saveCode();
    } else if (
        (isMacOS && event.code === "KeyL" && event.metaKey) ||
        (event.code === "KeyL" && event.ctrlKey)
    ) {
        event.preventDefault();
        clearTerminal();
    } else if (event.code === "KeyB" && event.ctrlKey) {
        event.preventDefault();
        startDebug();
    }
}

function resizeColumn() {
    isResizing = true;
}

function onMouseMove(e: any) {
    if (!isResizing) {
        return;
    }
    e.preventDefault();
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
        brs.redraw(
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
        return getBaseUrl() + "?code=" + text;
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
