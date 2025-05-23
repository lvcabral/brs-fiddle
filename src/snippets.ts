/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from "@zenfs/core";
import { Zip } from "@zenfs/archives";
import { WebStorage } from "@zenfs/dom";
import { zipSync, strToU8, Zippable } from "fflate";
import { saveAs } from "file-saver";
import { getIcon, getMimeType, isImageFile, showToast } from "./util";

const codeSelect = document.getElementById("code-selector") as HTMLSelectElement;
const folderStructure = document.querySelector(".folder-structure") as HTMLDivElement;
const fileSystemDiv = document.getElementById("file-system") as HTMLDivElement;
const imagePanel = document.getElementById("image-panel") as HTMLDivElement;
const imagePreview = document.getElementById("image-preview") as HTMLImageElement;

const codeMap = new Map<string, string>();

export async function initializeFileSystem() {
    await fs.configure({
        mounts: {
            "/code": { backend: WebStorage, storage: localStorage },
        },
    });
}

export function populateCodeSelector(currentId: string) {
    migrateOldSnippets();
    // Load from ZenFS
    const arrCode = new Array();
    codeMap.clear();
    const entries = fs.readdirSync("/code");
    for (const entry of entries) {
        if (entry.length === 10) {
            const codeName = readFileContent(`/code/${entry}/.snippet`);
            arrCode.push([codeName, entry]);
            codeMap.set(entry, codeName);
        }
    }
    // Populate code selector
    arrCode.sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
    const optionsOffset = 1;
    codeSelect.length = optionsOffset;
    for (let i = 0; i < arrCode.length; i++) {
        const codeId = arrCode[i][1];
        const selected = codeId === currentId;
        codeSelect.options[i + optionsOffset] = new Option(arrCode[i][0], codeId, false, selected);
    }
    updateCodeSelector(currentId, false);
}

function migrateOldSnippets() {
    // Convert 1.x localStorage format to ZenFS
    const ids = [];
    for (let i = 0; i < localStorage.length; i++) {
        const codeId = localStorage.key(i);
        if (codeId && codeId.length === 10) {
            ids.push(codeId);
        }
    }
    if (ids.length === 0) {
        return;
    }
    for (let i = 0; i < ids.length; i++) {
        const codeId = ids[i];
        console.log("Migrating code snippet: ", codeId);
        let codeName = `Code #${i + 1}`;
        const code = localStorage.getItem(codeId);
        if (code) {
            let source = code;
            if (code.startsWith("@=")) {
                codeName = code.substring(2, code.indexOf("=@"));
                source = code.substring(code.indexOf("=@") + 2);
            }
            if (!fs.existsSync(`/code/${codeId}`)) {
                saveCodeSnippetMaster(codeId, codeName, source);
            }
            localStorage.removeItem(codeId);
        }
    }
}

export function updateCodeSelector(currentId: string, isCodeChanged: boolean) {
    const options = Array.from(codeSelect.options);
    for (const option of options) {
        if (option.value === currentId) {
            if (isCodeChanged) {
                option.text = `• ${option.text.replace(/^• /, "")}`;
            } else {
                option.text = option.text.replace(/^• /, "");
            }
        }
    }
}

async function mountZip(zipName: string) {
    const res = await fetch(`./templates/${zipName}`);
    if (res.status !== 200) {
        return false;
    }
    const templateZip = await res.arrayBuffer();
    if (templateZip) {
        fs.umount("/mnt/zip");
        const zipFs = await fs.resolveMountConfig({
            backend: Zip,
            data: templateZip,
        });
        fs.mount("/mnt/zip", zipFs);
        return true;
    }
    return false;
}

export async function loadZipTemplate(currentId: string, name: string, file: string) {
    try {
        const mounted = await mountZip(file);
        if (!mounted) {
            showToast(`The template is missing: ${name}`, 5000, true);
            return;
        }
        const targetPath = `/code/${currentId}`;
        replicateContent("/mnt/zip", targetPath);
        fs.writeFileSync(`${targetPath}/.snippet`, name);
    } catch (err: any) {
        showToast(`Error loading template ${file}: ${err.message}`, 5000, true);
    }
}

export async function loadBrsTemplate(currentId: string, name: string, file: string) {
    try {
        const res = await fetch(`./templates/${file}`);
        const code = await res.text();
        if (res.status === 200 && code) {
            saveCodeSnippetMaster(currentId, name, code);
        } else {
            showToast(`The template is missing: ${name}`, 5000, true);
        }
    } catch (err: any) {
        showToast(`Error loading template ${file}: ${err.message}`, 5000, true);
    }
}

export function loadCodeSnippet(currentId: string) {
    const targetPath = `/code/${currentId}`;
    const fileStructure = readDirectory(targetPath);
    fileSystemDiv.innerHTML = generateFileStructureHTML(fileStructure);
}

export function createZipFromCodeSnippet(codeId: string): Uint8Array | null {
    const targetPath = `/code/${codeId}`;
    let newZip: Zippable = {};

    function addFilesToZip(directoryPath: string, zipPath: string) {
        const entries = fs.readdirSync(directoryPath);

        for (const entry of entries) {
            const entryPath = `${directoryPath}/${entry}`;
            const stat = fs.statSync(entryPath);
            const newPath = zipPath ? `${zipPath}/${entry}` : entry;
            if (stat.isDirectory()) {
                addFilesToZip(entryPath, newPath);
            } else if (isImageFile(entry)) {
                const content = fs.readFileSync(entryPath);
                newZip[newPath] = [content, { level: 0 }];
            } else if (newPath !== ".snippet") {
                let content = fs.readFileSync(entryPath, "utf-8");
                newZip[newPath] = [strToU8(content), {}];
            }
        }
    }

    addFilesToZip(targetPath, "");

    return zipSync(newZip);
}

export function replicateContent(sourcePath: string, targetPath: string) {
    const entries = fs.readdirSync(sourcePath);
    ensureDirectoryExists(targetPath);

    for (const entry of entries) {
        const sourceEntryPath = `${sourcePath}/${entry}`;
        const targetEntryPath = `${targetPath}/${entry}`;
        const stat = fs.statSync(sourceEntryPath);

        if (stat.isDirectory()) {
            replicateContent(sourceEntryPath, targetEntryPath);
        } else {
            const content = fs.readFileSync(sourceEntryPath);
            fs.writeFileSync(targetEntryPath, content);
        }
    }
}

function ensureDirectoryExists(directoryPath: string) {
    const pathParts = directoryPath.split("/");
    let currentPath = "";

    for (const part of pathParts) {
        if (part) {
            currentPath += `/${part}`;
            if (!fs.existsSync(currentPath)) {
                fs.mkdirSync(currentPath);
            }
        }
    }
}

function readDirectory(path: string): any {
    const structure: any = {};
    const entries = fs.readdirSync(path);
    for (const entry of entries) {
        const newPath = `${path}/${entry}`;
        if (fs.statSync(newPath).isDirectory()) {
            structure[entry] = readDirectory(newPath);
        } else {
            structure[entry] = null;
        }
    }
    return structure;
}

function generateFileStructureHTML(structure: any, path = ""): string {
    let html = "<ul>";
    for (const key in structure) {
        if (key.startsWith(".")) {
            continue;
        }
        const fullPath = path ? `${path}/${key}` : key;
        if (structure[key] === null) {
            const icon = getIcon(key);
            if (key === "main.brs") {
                currSelectedPath = fullPath;
                html += `<li data-type="file" data-path="${fullPath}" class="selected"><i class="${icon}"></i>${key}</li>`;
            } else {
                html += `<li data-type="file" data-path="${fullPath}"><i class="${icon}"></i>${key}</li>`;
            }
        } else {
            html += `<li data-type="folder"><i class="icon-folder-open"></i>${key}`;
            html += generateFileStructureHTML(structure[key], fullPath);
            html += "</li>";
        }
    }
    html += "</ul>";
    return html;
}

export function readFileContent(filePath: string): string {
    try {
        return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
        console.error("error reading ", filePath, error);
        return "";
    }
}

export function codeSnippetExists(codeId: string): boolean {
    return fs.existsSync(`/code/${codeId}`);
}

export function codeNameExists(codeName: string) {
    return Array.from(codeMap.values()).includes(codeName);
}

export function hasManifest(codeId: string) {
    return fs.existsSync(`/code/${codeId}/manifest`);
}

export function saveCodeSnippetMaster(codeId: string, codeName: string, code: string) {
    try {
        fs.mkdirSync(`/code/${codeId}`);
        fs.writeFileSync(`/code/${codeId}/.snippet`, codeName);
        fs.mkdirSync(`/code/${codeId}/source`);
        fs.writeFileSync(`/code/${codeId}/source/main.brs`, code);
    } catch (err: any) {
        showToast(`Error saving code snippet ${codeName}: ${err.message}`, 5000, true);
    }
}

export function saveCodeSnippet(codeId: string, code: string) {
    const targetPath = `/code/${codeId}`;
    try {
        if (fs.existsSync(`${targetPath}/${currSelectedPath}`)) {
            fs.writeFileSync(`${targetPath}/${currSelectedPath}`, code);
            return true;
        } else {
            showToast(`File not found: ${currSelectedPath}`, 5000, true);
        }
    } catch (err: any) {
        showToast(`Error saving code snippet: ${err.message}`, 5000, true);
    }
    return false;
}

export function saveCodeSnippetAs(oldId: string, newId: string, name: string) {
    const oldPath = `/code/${oldId}`;
    const newPath = `/code/${newId}`;
    if (fs.existsSync(oldPath)) {
        replicateContent(oldPath, newPath);
        fs.writeFileSync(`${newPath}/.snippet`, name);
        return true;
    } else {
        showToast(`Code snippet not found: ${oldId}`, 5000, true);
    }
    return false;
}

export function renameCodeSnippet(codeId: string, codeName: string) {
    const targetPath = `/code/${codeId}/.snippet`;
    try {
        fs.writeFileSync(targetPath, codeName);
        codeMap.set(codeId, codeName);
    } catch (err: any) {
        showToast(`Error renaming code snippet: ${err.message}`, 5000, true);
    }
}

export function deleteCodeSnippet(codeId: string) {
    const targetPath = `/code/${codeId}`;
    if (fs.existsSync(targetPath)) {
        deleteDirectoryRecursively(targetPath);
    } else {
        showToast("Code snippet not found", 5000, true);
    }
}

function deleteDirectoryRecursively(directoryPath: string) {
    const entries = fs.readdirSync(directoryPath);

    for (const entry of entries) {
        const entryPath = `${directoryPath}/${entry}`;
        const stat = fs.statSync(entryPath);

        if (stat.isDirectory()) {
            deleteDirectoryRecursively(entryPath);
        } else {
            try {
                fs.unlinkSync(entryPath);
            } catch (error) {
                console.error("error deleting file: ", entryPath, error);
            }
        }
    }
    try {
        fs.rmdirSync(directoryPath);
    } catch (error) {
        console.error("error deleting folder: ", directoryPath, error);
    }
}

export function debugDirectory(path: string) {
    const entries = fs.readdirSync(path);
    for (const entry of entries) {
        const newPath = `${path}/${entry}`;
        if (fs.statSync(newPath).isDirectory()) {
            console.log("directory: ", newPath);
            debugDirectory(newPath);
        } else {
            console.log("file: ", newPath);
        }
    }
}

let currSelectedPath = "";
export function highlightSelectedFile(target: HTMLElement) {
    const selected = folderStructure?.querySelector("li.selected");
    if (selected) {
        selected.classList.remove("selected");
    }
    target.classList.add("selected");
    currSelectedPath = target.getAttribute("data-path") ?? "";
}

let imageClick = 0;
export function showImage(filePath: string) {
    const imageData = fs.readFileSync(filePath);
    const blob = new Blob([imageData], { type: getMimeType(filePath) });
    const url = URL.createObjectURL(blob);
    imagePreview.src = url;
    imagePanel.style.display = "block";
    imageClick++;
    setTimeout(() => {
        imageClick--;
        if (imageClick === 0) {
            hideImage();
        }
        URL.revokeObjectURL(url); // Revoke the object URL after the image is hidden
    }, 10000); // Hide the image after 10 seconds
}

export function hideImage() {
    imagePanel.style.display = "none";
    imagePreview.src = "";
}

interface CodeSnippet {
    name: string;
    files: { [path: string]: string };
}

export function exportAllCode() {
    const codes: { [key: string]: CodeSnippet } = {};
    const entries = fs.readdirSync("/code");

    for (const entry of entries) {
        if (entry.length === 10) {
            const codeName = readFileContent(`/code/${entry}/.snippet`);
            const files: { [path: string]: string } = {};
            readFilesRecursively(`/code/${entry}`, "", files);
            codes[entry] = { name: codeName, files };
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

function readFilesRecursively(
    directoryPath: string,
    relativePath: string,
    files: { [path: string]: string }
) {
    const entries = fs.readdirSync(directoryPath);

    for (const entry of entries) {
        const entryPath = `${directoryPath}/${entry}`;
        const newRelativePath = relativePath ? `${relativePath}/${entry}` : entry;
        const stat = fs.statSync(entryPath);
        if (entry.startsWith(".")) {
            continue;
        }
        if (stat.isDirectory()) {
            readFilesRecursively(entryPath, newRelativePath, files);
        } else {
            const content = fs.readFileSync(entryPath);
            if (isImageFile(entry)) {
                files[newRelativePath] = `data:image/${getFileExtension(
                    entry
                )};base64,${content.toString("base64")}`;
            } else {
                files[newRelativePath] = content.toString("utf-8");
            }
        }
    }
}

function getFileExtension(fileName: string): string {
    return fileName.split(".").pop() ?? "";
}

export function exportCodeSnippet(codeId: string) {
    const codes: { [key: string]: CodeSnippet } = {};
    const targetPath = `/code/${codeId}`;

    if (fs.existsSync(targetPath)) {
        const codeName = readFileContent(`${targetPath}/.snippet`);
        const files: { [path: string]: string } = {};
        readFilesRecursively(targetPath, "", files);
        codes[codeId] = { name: codeName, files };

        const safeFileName = codeName
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/^• /, "")
            .replace(/[^a-z0-9-]/g, "");
        const json = JSON.stringify(codes, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        saveAs(blob, `${safeFileName}.json`);
        URL.revokeObjectURL(url);
    } else {
        showToast("Code snippet not found", 3000, true);
    }
}

export async function importCodeSnippet(): Promise<void> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.onchange = (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e: ProgressEvent<FileReader>) => {
                    try {
                        const json = e.target?.result as string;
                        const codes: { [key: string]: CodeSnippet } = JSON.parse(json);
                        for (const id in codes) {
                            const code = codes[id];
                            const targetPath = `/code/${id}`;
                            if (!fs.existsSync(targetPath)) {
                                fs.mkdirSync(targetPath);
                            }
                            fs.writeFileSync(`${targetPath}/.snippet`, code.name);
                            for (const filePath in code.files) {
                                const fullPath = `${targetPath}/${filePath}`;
                                ensureDirectoryExists(
                                    fullPath.substring(0, fullPath.lastIndexOf("/"))
                                );
                                const content = code.files[filePath];
                                if (content.startsWith("data:image/")) {
                                    const base64Data = content.split(",")[1];
                                    fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
                                } else {
                                    fs.writeFileSync(fullPath, content);
                                }
                            }
                        }
                        resolve();
                    } catch (error: any) {
                        showToast("Failed to import code snippets", 3000, true);
                        reject(error);
                    }
                };
                reader.readAsText(file);
            } else {
                reject(new Error("No file selected"));
            }
        };
        input.click();
    });
}
