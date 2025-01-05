/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as brs from "brs-engine";
import Codec from "json-url";
import Toastify from "toastify-js";
import VanillaTerminal from "vanilla-terminal";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";
import { getOS } from "./util";
import { CodeMirrorManager, getCodeMirrorTheme } from "./codemirror";
import packageInfo from "../package.json";

const appId = "brsFiddle";
const isMacOS = getOS() === "MacOS";
const codec = Codec("lzma");
const brsCodeField = document.getElementById("brsCode") as HTMLTextAreaElement;
const saveButton = document.querySelector("button.save") as HTMLButtonElement;
const runButton = document.querySelector("button.run") as HTMLButtonElement;
const clearAllButton = document.querySelector("button.clear-all") as HTMLButtonElement;
const breakButton = document.querySelector("button.break") as HTMLButtonElement;
const resumeButton = document.querySelector("button.resume") as HTMLButtonElement;
const endButton = document.querySelector("button.end") as HTMLButtonElement;
const shareButton = document.querySelector("button.share") as HTMLButtonElement;
const layoutContainer = document.querySelector("main.editor") as HTMLElement;
const layoutSeparator = document.querySelector("div.layout-separator") as HTMLDivElement;
const codeColumn = document.querySelector("div.code") as HTMLDivElement;
const consoleColumn = document.querySelector("div.console") as HTMLDivElement;
const rightContainer = document.getElementById("right-container") as HTMLDivElement;
const displayCanvas = document.getElementById("display") as HTMLCanvasElement;
const keyboardSwitch = document.getElementById("keyboard") as HTMLInputElement;
const gamePadSwitch = document.getElementById("gamepad") as HTMLInputElement;
const audioSwitch = document.getElementById("audioSwitch") as HTMLInputElement;
const audioIcon = document.getElementById("audio-icon") as HTMLElement;
const themeSwitch = document.getElementById("darkTheme") as HTMLInputElement;
const themeIcon = document.getElementById("theme-icon") as HTMLElement;
const codeSelect = document.getElementById("code-selector") as HTMLSelectElement;
const codeDialog = document.getElementById("code-dialog") as HTMLDialogElement;
const actionType = document.getElementById("actionType") as HTMLInputElement;
const codeForm = document.getElementById("code-form") as HTMLFormElement;
const deleteDialog = document.getElementById("delete-dialog") as HTMLDialogElement;
const moreButton = document.getElementById("more-options") as HTMLButtonElement;
const dropdown = document.getElementById("more-options-dropdown") as HTMLDivElement;

// Restore Last State
const lastState = loadState();
audioSwitch.checked = lastState.audio;
keyboardSwitch.checked = lastState.keys;
gamePadSwitch.checked = lastState.gamePads;
themeSwitch.checked = lastState.darkTheme;

// Terminal Setup
const prompt = "Brightscript Debugger";
const commands = {
    help: (terminal: any) => {
        brs.debug("help");
    },
    version: (terminal: any) => {
        terminal.output(`<br />BrightScript Simulation Engine v${brs.getVersion()}<br />`);
    },
};
const terminal = new VanillaTerminal({
    welcome: `<span style='color: #2e71ff'>BrightScript Console - ${packageInfo.name} v${
        packageInfo.version
    } -  brs-engine v${brs.getVersion()}</span>`,
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
clearAllButton.addEventListener("click", clearTerminal);
breakButton.addEventListener("click", startDebug);
resumeButton.addEventListener("click", resumeExecution);
endButton.addEventListener("click", endExecution);
shareButton.addEventListener("click", shareCode);
layoutSeparator.addEventListener("mousedown", resizeColumn);
moreButton.addEventListener("click", function (event) {
    event.stopPropagation();
    if (dropdown.style.display === "block") {
        dropdown.style.display = "none";
    } else {
        dropdown.style.display = "block";
    }
});
document.addEventListener("click", function (event: any) {
    if (!dropdown.contains(event.target) && event.target !== moreButton) {
        dropdown.style.display = "none";
    }
});
document.getElementById("rename-option")?.addEventListener("click", renameCode);
document.getElementById("saveas-option")?.addEventListener("click", saveAsCode);
document.getElementById("delete-option")?.addEventListener("click", deleteCode);
document.getElementById("export-option")?.addEventListener("click", exportCode);
document.getElementById("export-all-option")?.addEventListener("click", exportAllCode);
document.getElementById("import-option")?.addEventListener("click", importCode);

let currentApp = { id: "", running: false };
let consoleLogsContainer = document.getElementById("console-logs") as HTMLDivElement;
let isResizing = false;
let editorManager: CodeMirrorManager;
let currentId = nanoid(10);

function main() {
    updateButtons();
    initializeCodeEditor();
    // Process Shared Token parameter
    const shareToken = getParameterByName("code");
    if (shareToken) {
        getCodeFromToken(shareToken).then(function (data: any) {
            if (data?.id && data?.code) {
                localStorage.setItem(data.id, data.code);
                localStorage.setItem(`${appId}.load`, data.id);
            }
            window.location.href = getBaseUrl();
        });
        return;
    }
    // Process id parameter
    const paramId = getParameterByName("id");
    if (paramId?.length) {
        localStorage.setItem(`${appId}.load`, paramId);
        window.location.href = getBaseUrl();
        return;
    }
    // Check saved id to load
    const loadId = localStorage.getItem(`${appId}.load`) ?? lastState.codeId;
    populateCodeSelector(loadId);
    if (loadId?.length) {
        loadCode(loadId);
    }
    localStorage.removeItem(`${appId}.load`);
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
        brs.subscribe(appId, handleEngineEvents);
        // Resize screen
        onResize();
        // Handle console commands
        terminal.onInput((command: string, parameters: string[], handled: boolean) => {
            if (!handled) {
                brs.debug(`${command} ${parameters.join(" ")}`);
            }
        });
    }
}

function updateButtons() {
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
}

function initializeCodeEditor() {
    if (brsCodeField) {
        editorManager = new CodeMirrorManager(brsCodeField, "dark");
        if (isMacOS) {
            // Remove binding for Ctrl+V on MacOS to allow remapping
            // https://github.com/codemirror/codemirror5/issues/5848
            const cm = document.querySelector(".CodeMirror") as any;
            if (cm) delete cm.CodeMirror.constructor.keyMap.emacsy["Ctrl-V"];
        }
    }
    setTheme(lastState.darkTheme);
    const { height } = codeColumn.getBoundingClientRect();
    editorManager.editor.setSize("100%", `${height - 40}px`);
}

function handleEngineEvents(event: string, data: any) {
    if (event === "loaded") {
        currentApp = data;
        terminal.output(`<br />Executing source code...<br /><br />`);
        terminal.idle();
    } else if (event === "started") {
        currentApp = data;
        console.info(`Execution started ${appId}`);
        runButton.style.display = "none";
        endButton.style.display = "inline";
        breakButton.style.display = "inline";
    } else if (event === "debug") {
        logToTerminal(data);
        scrollToBottom();
    } else if (event === "closed" || event === "error") {
        currentApp = data;
        console.info(`Execution terminated! ${event}: ${data}`);
        terminal.idle();
        runButton.style.display = "inline";
        endButton.style.display = "none";
        resumeButton.style.display = "none";
        breakButton.style.display = "none";
    }
}

function logToTerminal(data: any) {
    if (data.level === "stop") {
        terminal.output("<br />");
        terminal.setPrompt();
        resumeButton.style.display = "inline";
        breakButton.style.display = "none";
    } else if (data.level === "continue") {
        terminal.idle();
        resumeButton.style.display = "none";
        breakButton.style.display = "inline";
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

// Code Events
function populateCodeSelector(currentId: string) {
    const arrCode = new Array();
    for (let i = 0; i < localStorage.length; i++) {
        const codeId = localStorage.key(i);
        if (codeId && codeId.length === 10) {
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
    for (let i = 0; i < arrCode.length; i++) {
        const codeId = arrCode[i][1];
        const selected = codeId === currentId;
        codeSelect.options[i + 1] = new Option(arrCode[i][0], codeId, false, selected);
    }
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

function renameCode() {
    if (currentId && localStorage.getItem(currentId)) {
        actionType.value = "rename";
        codeForm.codeName.value = codeSelect.options[codeSelect.selectedIndex].text;
        codeDialog.showModal();
    } else {
        showToast("There is no code snippet selected to rename!", 3000, true);
    }
}

function saveAsCode() {
    if (currentId && localStorage.getItem(currentId)) {
        actionType.value = "saveas";
        codeForm.codeName.value = codeSelect.options[codeSelect.selectedIndex].text + " (Copy)";
        codeDialog.showModal();
    } else {
        showToast("There is no code snippet selected to save as!", 3000, true);
    }
}

function deleteCode() {
    if (currentId && localStorage.getItem(currentId)) {
        deleteDialog.showModal();
    } else {
        showToast("There is no code snippet selected to delete!", 3000, true);
    }
}

interface CodeSnippet {
    name: string;
    content: string;
}

function exportCode() {
    const codes: { [key: string]: CodeSnippet } = {};
    let codeContent = editorManager.editor.getValue();
    if (codeContent && codeContent.trim() !== "") {
        if (codeSelect.value !== "0") {
            let codeName = codeSelect.options[codeSelect.selectedIndex].text;
            codes[currentId] = { name: codeName, content: codeContent };
            const safeFileName = codeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
            const json = JSON.stringify(codes, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            saveAs(blob, `${safeFileName}.json`);
            URL.revokeObjectURL(url);
        } else {
            showToast("Please save your Code Snipped before exporting!", 3000, true);
            return;
        }
    } else {
        showToast("There is no Code Snippet to Export", 3000, true);
    }
}

function exportAllCode() {
    const codes: { [key: string]: CodeSnippet } = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.length === 10) {
            const value = localStorage.getItem(key);
            if (value?.startsWith("@=")) {
                const codeName = value.substring(2, value.indexOf("=@"));
                const codeContent = value.substring(value.indexOf("=@") + 2);
                codes[key] = { name: codeName, content: codeContent };
            }
        }
    }
    const json = JSON.stringify(codes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codesnippets.json";
    a.click();
    URL.revokeObjectURL(url);
}

function importCode() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                const json = e.target?.result as string;
                const codes: { [key: string]: CodeSnippet } = JSON.parse(json);
                for (const id in codes) {
                    const code = codes[id];
                    const value = `@=${code.name}=@${code.content}`;
                    localStorage.setItem(id, value);
                }
                populateCodeSelector(currentId);
                if (Object.keys(codes).length === 1) {
                    showToast("Code snippet imported to the browser local storage!", 3000);
                    const loadId = Object.keys(codes)[0];
                    loadCode(loadId);
                } else {
                    showToast("Code snippets imported to the browser local storage!", 3000);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

deleteDialog.addEventListener("close", (e) => {
    if (deleteDialog.returnValue === "ok") {
        localStorage.removeItem(currentId);
        currentId = nanoid(10);
        resetApp();
        showToast("Code deleted from the browser local storage!", 3000);
    }
    deleteDialog.returnValue = "";
});

function resetApp(id = "", code = "") {
    populateCodeSelector(id);
    if (currentApp.running) {
        brs.terminate("EXIT_USER_NAV");
        clearTerminal();
    }
    const ctx = displayCanvas.getContext("2d", { alpha: false });
    ctx?.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    editorManager.editor.setValue(code);
    editorManager.editor.focus();
    lastState.codeId = id;
    saveState();
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
            if (shareLink.length > 2048) {
                showToast("Share URL copied to clipboard, but it's longer than 2048 bytes, consider exporting as a file instead!", 7000, true);
            } else {
                showToast("Share URL copied to clipboard");
            }
        });
    } else {
        showToast("There is no Source Code to share", 3000, true);
    }
}

function saveCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        if (codeSelect.value === "0") {
            actionType.value = "save";
            codeDialog.showModal();
        } else {
            const codeName = codeSelect.options[codeSelect.selectedIndex].text;
            localStorage.setItem(currentId, `@=${codeName}=@${code}`);
            showToast(
                "Code saved in the browser local storage!\nTo share it use the Share button.",
                5000
            );
        }
    } else {
        showToast("There is no Source Code to save", 3000, true);
    }
}

codeDialog.addEventListener("close", (e) => {
    if (codeDialog.returnValue === "ok") {
        const codeName = codeForm.codeName.value.trim();
        if (codeName.length < 3) {
            showToast("Code snippet name must have least 3 characters!", 3000, true);
            resetDialog();
            return;
        }
        if (codeNameExists(codeName)) {
            showToast("There is already a code snippet with this Name!", 3000, true);
            resetDialog();
            return;
        }
        const code = editorManager.editor.getValue();
        if (actionType.value === "saveas") {
            currentId = nanoid(10);
        }
        localStorage.setItem(currentId, `@=${codeName}=@${code}`);
        lastState.codeId = currentId;
        saveState();
        populateCodeSelector(currentId);
        if (actionType.value === "rename") {
            showToast("Code snippet renamed in the browser local storage.", 5000);
        } else {
            showToast(
                "Code saved in the browser local storage!\nTo share it use the Share button.",
                5000
            );
        }
    }
    resetDialog();
});

function resetDialog() {
    codeDialog.returnValue = "";
    codeForm.codeName.value = "";
}

function codeNameExists(codeName: string) {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.length === 10) {
            const value = localStorage.getItem(key);
            if (value?.startsWith("@=")) {
                const itemName = value.substring(2, value.indexOf("=@"));
                if (itemName.toLocaleLowerCase() === codeName.toLocaleLowerCase()) {
                    return true;
                }
            }
        }
    }
    return false;
}

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
    if (currentApp.running) {
        brs.debug("break");
    } else {
        showToast("There is nothing running to debug", 3000, true);
    }
}

function resumeExecution() {
    if (currentApp.running) {
        brs.debug("cont");
    }
}

function endExecution() {
    if (currentApp.running) {
        brs.terminate("EXIT_USER_NAV");
    } else {
        showToast("There is nothing running to terminate", 3000, true);
    }
}

function clearTerminal() {
    terminal.clear();
}

// Switches Events
themeSwitch.addEventListener("click", (e) => {
    themeIcon.className = themeSwitch.checked ? "icon-moon" : "icon-sun";
    lastState.darkTheme = themeSwitch.checked;
    setTheme(lastState.darkTheme);
    saveState();
});

audioSwitch.addEventListener("click", (e) => {
    audioIcon.className = audioSwitch.checked ? "icon-sound-on" : "icon-sound-off";
    lastState.audio = audioSwitch.checked;
    brs.setAudioMute(!lastState.audio);
    saveState();
});

keyboardSwitch.addEventListener("click", controlModeSwitch);
gamePadSwitch.addEventListener("click", controlModeSwitch);

function controlModeSwitch() {
    brs.setControlMode({
        keyboard: keyboardSwitch.checked,
        gamePads: gamePadSwitch.checked,
    });
    lastState.keys = keyboardSwitch.checked;
    lastState.gamePads = gamePadSwitch.checked;
    saveState();
}

//Keyboard Event
function hotKeys(event: KeyboardEvent) {
    const el = document.activeElement;
    const isCodeEditor = el?.id === "brsCode";
    brs.setControlMode({
        keyboard: isCodeEditor ? false : keyboardSwitch.checked,
        gamePads: gamePadSwitch.checked,
    });
    if (isHotKey(event, "KeyR")) {
        event.preventDefault();
        runCode();
    } else if (isHotKey(event, "KeyS")) {
        event.preventDefault();
        saveCode();
    } else if (isHotKey(event, "KeyL")) {
        event.preventDefault();
        clearTerminal();
    } else if (currentApp.running) {
        if (
            (isMacOS && event.code === "KeyC" && event.ctrlKey) ||
            (!isMacOS && event.code === "KeyB" && event.ctrlKey)
        ) {
            event.preventDefault();
            startDebug();
        } else if (
            (isMacOS && event.code === "Escape" && event.ctrlKey) ||
            (!isMacOS && event.code === "Home")
        ) {
            event.preventDefault();
            endExecution();
        }
    }
}

function isHotKey(event: KeyboardEvent, keyCode: string) {
    return (
        (isMacOS && event.code === keyCode && event.metaKey) ||
        (!isMacOS && event.code === keyCode && event.ctrlKey)
    );
}

// Resize Events
function resizeColumn() {
    isResizing = true;
}

function resizeCanvas() {
    let width = displayCanvas.width;
    let height = displayCanvas.height;
    if (window.innerWidth >= 1220) {
        const rightRect = rightContainer.getBoundingClientRect();
        width = rightRect.width;
        height = Math.trunc((width * 9) / 16);
    } else {
        height = window.innerHeight / 3;
        width = Math.trunc((height * 16) / 9);
        if (width > window.innerWidth) {
            width = window.innerWidth;
            height = Math.trunc((width * 9) / 16);
        }
    }
    brs.redraw(false, width, height);
}

function onResize() {
    resizeCanvas();
    if (window.innerWidth >= 1220) {
        const { height } = codeColumn.getBoundingClientRect();
        editorManager.editor.setSize("100%", `${height - 25}px`);
        consoleLogsContainer.style.height = `100%`;
    } else {
        editorManager.editor.setSize("100%", `${Math.trunc(window.innerHeight / 3.5)}px`);
        codeColumn.style.width = "100%";
        const consoleRect = consoleLogsContainer.getBoundingClientRect();
        const logHeight = window.innerHeight - consoleRect.top;
        consoleLogsContainer.style.height = `${logHeight}px`;
    }
    scrollToBottom();
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
        codeColumn.style.width = codeColumnWidth;
        rightContainer.style.width = `${rightRect.width}px`;
        resizeCanvas();
    }
}

function onMouseUp() {
    if (isResizing) {
        resizeCanvas();
        scrollToBottom();
    }
    isResizing = false;
}

function onMouseDown(event: Event) {
    if (isResizing) {
        event.preventDefault();
    }
}

// Helper Functions
function getParameterByName(name: string, url = window.location.href) {
    name = name.replace(/[[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
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
    const data = [suite.id, suite.code];
    return codec.compress(data).then(function (text: string) {
        return getBaseUrl() + "?code=" + text;
    });
}

function getBaseUrl(): string {
    let url = window.location.origin + window.location.pathname;
    if (url.endsWith("/")) {
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

function loadState() {
    let state = {
        codeId: "",
        audio: true,
        keys: true,
        gamePads: true,
        darkTheme: isDarkTheme(),
    };
    const savedState = localStorage.getItem(`${appId}.state`);
    if (savedState) {
        state = Object.assign(state, JSON.parse(savedState));
    }
    return state;
}

function saveState() {
    localStorage.setItem(`${appId}.state`, JSON.stringify(lastState));
}

// Theme Management
function isDarkTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)")?.matches;
}
function setTheme(dark: boolean) {
    const theme = dark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.body.style.colorScheme = theme;
    codeColumn.style.colorScheme = theme;
    consoleColumn.style.colorScheme = theme;
    rightContainer.style.colorScheme = theme;
    if (editorManager) {
        editorManager.editor.setOption("theme", getCodeMirrorTheme(theme));
    }
}

// Event Listeners
window.addEventListener("load", main, false);
window.addEventListener("resize", onResize, false);
document.addEventListener("keydown", hotKeys, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);
document.addEventListener("mousedown", onMouseDown, false);
