/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as brs from "brs-engine";
import Codec from "json-url";
import WebTerminal from "@lvcabral/terminal";
import {
    initializeFileSystem,
    hideImage,
    highlightSelectedFile,
    showImage,
    readFileContent,
    loadZipTemplate,
    populateCodeSelector,
    updateCodeSelector,
    codeSnippetExists,
    deleteCodeSnippet,
    codeNameExists,
    renameCodeSnippet,
    loadCodeSnippet,
    saveCodeSnippet,
    saveCodeSnippetAs,
    saveCodeSnippetMaster,
    loadBrsTemplate,
    hasManifest,
    createZipFromCodeSnippet,
    exportAllCode,
    exportCodeSnippet,
    importCodeSnippet,
} from "./snippets";
import {
    calculateLocalStorageUsage,
    generateId,
    getFileExtension,
    getOS,
    isImageFile,
    showToast,
} from "./util";
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
const toggleTreeButton = document.querySelector("button.toggle-tree") as HTMLButtonElement;
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
const confirmDialog = document.getElementById("confirm-dialog") as HTMLDialogElement;
const dialogText = document.getElementById("dialog-text") as HTMLParagraphElement;
const confirmButton = document.getElementById("confirm-button") as HTMLButtonElement;
const cancelButton = document.getElementById("cancel-button") as HTMLButtonElement;
const moreButton = document.getElementById("more-options") as HTMLButtonElement;
const dropdown = document.getElementById("more-options-dropdown") as HTMLDivElement;
const folderStructure = document.querySelector(".folder-structure") as HTMLDivElement;
const fileSystemDiv = document.getElementById("file-system") as HTMLDivElement;
const simpleFileSystem = fileSystemDiv.innerHTML;
const templateDialog = document.getElementById("template-dialog") as HTMLDialogElement;

// Code Templates
const templates = [
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
const terminal = new WebTerminal({
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
toggleTreeButton.addEventListener("click", toggleFileTree);
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
document.getElementById("templates-option")?.addEventListener("click", selectTemplate);
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
let currentId = generateId();
let isCodeChanged = false;
let unchangedCode = "";
let lastSelectedFile = "";

async function main() {
    updateButtons();
    initializeCodeEditor();
    initFolderStructure();
    initFileTreeState();
    await initializeFileSystem();
    populateTemplateDialog();
    // Process Shared Token parameter
    const shareToken = getParameterByName("code");
    if (shareToken) {
        getCodeFromToken(shareToken).then(function (data: any) {
            if (data?.id && data?.code) {
                localStorage.setItem(data.id, data.code);
                localStorage.setItem(`${appId}.load`, data.id);
            }
            globalThis.location.href = getBaseUrl();
        });
        return;
    }
    // Process id parameter
    const paramId = getParameterByName("id");
    if (paramId?.length) {
        localStorage.setItem(`${appId}.load`, paramId);
        globalThis.location.href = getBaseUrl();
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
        let corsProxy = "https://brs-cors-proxy.up.railway.app/";
        if (globalThis.location.hostname === "localhost") {
            corsProxy = "";
        }
        brs.initialize(
            { developerId: appId, corsProxy: corsProxy },
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
    editorManager.editor.focus();
    calculateLocalStorageUsage();
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
    editorManager.editor.on("change", () => {
        if (codeSelect.value === "0") {
            const code = editorManager.editor.getValue();
            if (code && code.trim() === "") {
                isCodeChanged = false;
                return;
            }
        }
        if (editorManager.editor.getValue() === unchangedCode) {
            markCodeAsSaved();
        } else {
            markCodeAsChanged();
        }
    });
}

function initFileTreeState() {
    // Restore file tree visibility from saved state
    if (lastState.showFileTree) {
        folderStructure.style.display = "block";
    } else {
        folderStructure.style.display = "none";
    }
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
    if (data?.level === "stop") {
        terminal.output("<br />");
        terminal.setPrompt();
        resumeButton.style.display = "inline";
        breakButton.style.display = "none";
    } else if (data?.level === "continue") {
        terminal.idle();
        resumeButton.style.display = "none";
        breakButton.style.display = "inline";
    } else if (data?.level !== "beacon" && typeof data?.content === "string") {
        let output = data.content.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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

function markCodeAsChanged() {
    isCodeChanged = true;
    updateCodeSelector(currentId, isCodeChanged);
}

function markCodeAsSaved() {
    isCodeChanged = false;
    updateCodeSelector(currentId, isCodeChanged);
}

let savedValue = codeSelect.value;
codeSelect.addEventListener("mousedown", async (e) => {
    savedValue = codeSelect.value;
});

function showDialog(message?: string): Promise<boolean> {
    return new Promise((resolve) => {
        if (message) {
            dialogText.innerText = message;
        }
        confirmDialog.showModal();

        confirmButton.onclick = () => {
            confirmDialog.close();
            resolve(true);
        };

        cancelButton.onclick = () => {
            confirmDialog.close();
            resolve(false);
        };
    });
}

codeSelect.addEventListener("change", async (e) => {
    if (isCodeChanged) {
        const confirmed = await showDialog(
            "There are unsaved changes, do you want to discard and continue?"
        );
        if (!confirmed) {
            e.preventDefault();
            codeSelect.value = savedValue;
            return;
        }
        const options = Array.from(codeSelect.options);
        for (const [index, option] of options.entries()) {
            const codeName = option.text.replace(/^• /, "");
            codeSelect.options[index].text = codeName;
        }
    }
    if (codeSelect.value === "0") {
        currentId = generateId();
        resetApp(false);
        fileSystemDiv.innerHTML = simpleFileSystem;
    } else {
        loadCode(codeSelect.value);
    }
    hideImage();
    resetUndoHistory();
});

function populateTemplateDialog() {
    const templateList = document.getElementById("template-list") as HTMLUListElement;
    templateList.innerHTML = "";
    for (const template of templates) {
        const li = document.createElement("li");
        li.textContent = template.name;
        li.dataset.path = template.path;
        li.addEventListener("click", async () => {
            templateDialog.close();
            if (codeNameExists(template.name)) {
                showToast("There is already a code snippet with this Name!", 3000, true);
                return;
            }
            currentId = generateId();
            if (getFileExtension(template.path) === "zip") {
                await loadZipTemplate(currentId, template.name, template.path);
            } else {
                await loadBrsTemplate(currentId, template.name, template.path);
            }
            populateCodeSelector(currentId);
            loadCode(currentId);
        });
        templateList.appendChild(li);
    }
    templateDialog.addEventListener("close", () => {
        editorManager.editor.focus();
    });
}

function resetUndoHistory() {
    editorManager?.editor?.clearHistory();
}

function loadCode(id: string) {
    if (codeSnippetExists(id)) {
        if (currentApp.running) {
            brs.terminate("EXIT_USER_NAV");
            clearTerminal();
        }
        currentId = id;
        loadCodeSnippet(id);
        unchangedCode = loadFile(`/code/${id}/source/main.brs`) ?? "";
        lastState.codeId = id;
        saveState();
        markCodeAsSaved();
    } else {
        showToast("Could not find the code in the Local Storage!", 3000, true);
    }
}

function selectTemplate() {
    templateDialog.showModal();
}

function renameCode() {
    if (currentId && codeSnippetExists(currentId)) {
        actionType.value = "rename";
        const codeName = codeSelect.options[codeSelect.selectedIndex].text;
        codeForm.codeName.value = codeName.replace(/^• /, "");
        codeDialog.showModal();
    } else {
        showToast("There is no code snippet selected to rename!", 3000, true);
    }
}

function saveAsCode() {
    const code = editorManager.editor.getValue();
    if (!code?.trim()) {
        showToast("There is no Source Code to save", 3000, true);
        return;
    }
    if (currentId && codeSnippetExists(currentId)) {
        actionType.value = "saveas";
        const codeName = codeSelect.options[codeSelect.selectedIndex].text + " (Copy)";
        codeForm.codeName.value = codeName.replace(/^• /, "");
    } else {
        actionType.value = "save";
        codeForm.codeName.value = "";
    }
    codeDialog.showModal();
}

async function deleteCode() {
    if (currentId && codeSnippetExists(currentId)) {
        const confirmed = await showDialog("Are you sure you want to delete this code?");
        if (confirmed) {
            deleteCodeSnippet(currentId);
            currentId = generateId();
            resetApp(true);
            fileSystemDiv.innerHTML = simpleFileSystem;
            unchangedCode = "";
            showToast("Code deleted from the browser local storage!", 3000);
        }
    } else {
        showToast("There is no code snippet selected to delete!", 3000, true);
    }
}

function exportCode() {
    let codeContent = editorManager.editor.getValue();
    if (codeContent && codeContent.trim() !== "") {
        exportCodeSnippet(currentId);
    } else {
        showToast("There is no Code Snippet to Export", 3000, true);
    }
}

function importCode() {
    importCodeSnippet().then(() => {
        showToast("Code snippet(s) imported to the browser local storage!", 3000);
        if (currentId) {
            populateCodeSelector(currentId);
            updateCodeSelector(currentId, isCodeChanged);
        } else {
            resetApp(true);
        }
    });
}

function resetApp(populate: boolean) {
    if (populate) {
        populateCodeSelector("");
    }
    if (currentApp.running) {
        brs.terminate("EXIT_USER_NAV");
        clearTerminal();
    }
    const ctx = displayCanvas.getContext("2d", { alpha: false });
    ctx?.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    unchangedCode = "";
    editorManager.editor.setValue("");
    editorManager.setMode("brightscript");
    editorManager.editor.focus();
    lastState.codeId = "";
    saveState();
    markCodeAsSaved();
}

function shareCode() {
    let code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        if (codeSelect.value !== "0") {
            let codeName = codeSelect.options[codeSelect.selectedIndex].text.replace(/^• /, "");
            code = `@=${codeName}=@${code}`;
        }
        const data = {
            id: currentId,
            code: code,
        };
        getShareUrl(data).then(function (shareLink: string) {
            navigator.clipboard.writeText(shareLink);
            if (shareLink.length > 2048) {
                showToast(
                    "Share URL copied to clipboard, but it's longer than 2048 bytes, consider exporting as a file instead!",
                    7000,
                    true
                );
            } else {
                showToast("Share URL copied to clipboard");
            }
        });
    } else {
        showToast("There is no Source Code to share", 3000, true);
    }
}

function toggleFileTree() {
    const isVisible = folderStructure.style.display !== "none";

    if (isVisible) {
        // Hide folder structure
        folderStructure.style.display = "none";
        lastState.showFileTree = false;
    } else {
        // Show folder structure
        folderStructure.style.display = "block";
        lastState.showFileTree = true;
    }

    saveState();

    // Recalculate editor size
    const codeRect = codeColumn.getBoundingClientRect();
    const folderRect = folderStructure?.getBoundingClientRect();
    const editorWidth =
        folderRect && folderStructure.style.display !== "none"
            ? codeRect.width - folderRect.width
            : codeRect.width;
    const editorHeight = codeRect.height - 40;

    editorManager.editor.setSize(`${editorWidth}px`, `${editorHeight}px`);
    editorManager.editor.refresh();
    editorManager.editor.focus();
}

function saveCode(toast?: any) {
    const code = editorManager.editor.getValue();
    if (!code?.trim()) {
        showToast("There is no Source Code to save", 3000, true);
        return;
    }
    if (codeSelect.value === "0") {
        actionType.value = "save";
        codeDialog.showModal();
        return;
    }
    const codeName = codeSelect.options[codeSelect.selectedIndex].text.replace(/^• /, "");
    if (saveCodeSnippet(currentId, code)) {
        codeSelect.options[codeSelect.selectedIndex].text = codeName;
        unchangedCode = code;
        if (typeof toast !== "boolean" || toast) {
            showToast(
                "Code saved in the browser local storage!\nTo share it use the Share button.",
                5000
            );
        }
        markCodeAsSaved();
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
        if (actionType.value === "rename") {
            renameCodeSnippet(currentId, codeName);
            populateCodeSelector(currentId);
            showToast("Code snippet renamed in the browser local storage.", 5000);
            resetDialog();
            return;
        } else if (actionType.value === "saveas") {
            const oldId = currentId;
            currentId = generateId();
            saveCodeSnippetAs(oldId, currentId, codeName);
            saveCodeSnippet(currentId, code);
        } else {
            saveCodeSnippetMaster(currentId, codeName, code);
        }
        unchangedCode = code;
        lastState.codeId = currentId;
        saveState();
        populateCodeSelector(currentId);
        showToast(
            "Code saved in the browser local storage!\nTo share it use the Share button.",
            5000
        );
        markCodeAsSaved();
    }
    resetDialog();
});

function resetDialog() {
    codeDialog.returnValue = "";
    codeForm.codeName.value = "";
    editorManager.editor.focus();
}

function runCode() {
    if (hasManifest(currentId)) {
        if (isCodeChanged) saveCode(false);
        const zipData = createZipFromCodeSnippet(currentId);
        if (zipData) {
            runZip(`${appId}.zip`, zipData.buffer);
        } else {
            showToast("There was an error creating the ZIP file!", 3000, true);
        }
        return;
    }
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        try {
            if (codeSelect.value !== "0" && isCodeChanged) {
                saveCode(false);
            }
            brs.execute(`main.brs`, editorManager.editor.getValue(), {
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

function runZip(pkg: string, zipData: ArrayBufferLike) {
    brs.execute(
        pkg,
        zipData,
        {
            clearDisplayOnExit: false,
            debugOnCrash: true,
            muteSound: !audioSwitch.checked,
        },
        new Map([["source", "auto-run-dev"]])
    );
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
    displayCanvas.focus();
}

//Keyboard Event
function hotKeys(event: KeyboardEvent) {
    brs.setControlMode({
        keyboard: editorManager.editor.hasFocus() ? false : keyboardSwitch.checked,
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
    if (globalThis.innerWidth >= 1220) {
        const rightRect = rightContainer.getBoundingClientRect();
        width = rightRect.width;
        height = Math.trunc((width * 9) / 16);
    } else {
        height = globalThis.innerHeight / 3;
        width = Math.trunc((height * 16) / 9);
        if (width > globalThis.innerWidth) {
            width = globalThis.innerWidth;
            height = Math.trunc((width * 9) / 16);
        }
    }
    brs.redraw(false, width, height);
}

function onResize() {
    resizeCanvas();
    if (globalThis.innerWidth >= 1220) {
        const { height } = codeColumn.getBoundingClientRect();
        editorManager.editor.setSize("100%", `${height - 25}px`);
        consoleLogsContainer.style.height = `100%`;
    } else {
        editorManager.editor.setSize("100%", `${Math.trunc(globalThis.innerHeight / 3.5)}px`);
        codeColumn.style.width = "100%";
        const consoleRect = consoleLogsContainer.getBoundingClientRect();
        const logHeight = globalThis.innerHeight - consoleRect.top;
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

        // Calculate actual editor width (code column minus folder structure width)
        const codeRect = codeColumn.getBoundingClientRect();
        const folderRect = folderStructure?.getBoundingClientRect();
        const editorWidth = folderRect ? codeRect.width - folderRect.width : codeRect.width;
        const editorHeight = codeRect.height - 40;

        // Set explicit width and refresh CodeMirror to recalculate line wrapping
        editorManager.editor.setSize(`${editorWidth}px`, `${editorHeight}px`);
        editorManager.editor.refresh();
    }
}

function onMouseUp() {
    if (isResizing) {
        resizeCanvas();
        scrollToBottom();
        // Ensure CodeMirror line wrapping is updated after resize
        editorManager.editor.refresh();
    }
    isResizing = false;
}

function onMouseDown(event: Event) {
    if (isResizing) {
        event.preventDefault();
    }
}

// Helper Functions
function getParameterByName(name: string, url = globalThis.location.href) {
    name = name.replaceAll(/[[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return "";
    return decodeURIComponent(results[2].replaceAll("+", " "));
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
    let url = globalThis.location.origin + globalThis.location.pathname;
    if (url.endsWith("/")) {
        url = url.slice(0, -1);
    }
    return url;
}

function loadState() {
    let state = {
        codeId: "",
        audio: true,
        keys: true,
        gamePads: true,
        darkTheme: isDarkTheme(),
        showFileTree: true,
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
    return globalThis.matchMedia("(prefers-color-scheme: dark)")?.matches;
}
function setTheme(dark: boolean) {
    const theme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.body.style.colorScheme = theme;
    codeColumn.style.colorScheme = theme;
    consoleColumn.style.colorScheme = theme;
    rightContainer.style.colorScheme = theme;
    if (editorManager) {
        editorManager.editor.setOption("theme", getCodeMirrorTheme(theme));
    }
}

// Event Listeners
globalThis.addEventListener("load", main, false);
globalThis.addEventListener("resize", onResize, false);
document.addEventListener("keydown", hotKeys, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);
document.addEventListener("mousedown", onMouseDown, false);
globalThis.addEventListener("beforeunload", (event) => {
    if (isCodeChanged) {
        const confirmationMessage = "You have unsaved changes. Are you sure you want to leave?";
        event.returnValue = confirmationMessage; // Standard way to display a confirmation dialog
        return confirmationMessage; // For some browsers
    }
    return null;
});

export function initFolderStructure() {
    const codeContent = document.querySelector(".code-content");
    const editor = editorManager.editor;

    folderStructure?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "LI" || target.tagName === "I") {
            const fileName = target.textContent?.trim();
            const isFolder = target.dataset.type === "folder";
            const filePath = target.dataset.path;
            if (fileName && !isFolder && filePath) {
                const targetPath = `/code/${currentId}`;
                const file = `${targetPath}/${filePath}`;
                if (lastSelectedFile === file) {
                    editor.focus();
                    return;
                }
                if (isImageFile(file)) {
                    showImage(file);
                    return;
                }
                hideImage();
                if (codeSelect.value !== "0" && isCodeChanged) {
                    saveCode(false);
                }
                loadFile(file);
                highlightSelectedFile(target);
            }
            editor.focus();
        }
    });

    codeContent?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (!target.closest(".folder-structure") && !target.closest(".CodeMirror")) {
            editor.focus();
        }
    });
}

function loadFile(filePath: string) {
    // Load the file content based on the fileName
    const editor = editorManager.editor;
    const fileContent = readFileContent(filePath);
    let mode;
    const extension = getFileExtension(filePath);
    switch (extension) {
        case "brs":
            mode = "brightscript";
            break;
        case "xml":
            mode = "xml";
            break;
        case "":
            mode = "properties";
            break;
        default:
            showToast("Unknown file cannot be loaded in the code editor.", 3000, true);
            return;
    }
    lastSelectedFile = filePath;
    editor.setValue(fileContent);
    editor.setOption("mode", mode);
    markCodeAsSaved();
    editor.focus();
    return fileContent;
}
