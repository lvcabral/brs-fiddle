/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from "@zenfs/core";
import { initializeFileSystem } from "../src/snippets";

/**
 * Puts ZenFS back to an empty `/code` mounted on a cleared localStorage.
 *
 * The unmounts are required: `fs.mount()` throws EINVAL on a mount point that is already in
 * use, so calling `initializeFileSystem()` twice without them fails.
 */
export async function resetFs() {
    if (fs.mounts.has("/mnt/zip")) {
        fs.umount("/mnt/zip");
    }
    if (fs.mounts.has("/code")) {
        fs.umount("/code");
    }
    localStorage.clear();
    await initializeFileSystem();
}

/**
 * Remounts `/code` over the *same* localStorage, simulating a page reload. Used to prove a
 * snippet really persisted rather than living in an in-memory cache.
 */
export async function remountFs() {
    if (fs.mounts.has("/code")) {
        fs.umount("/code");
    }
    await initializeFileSystem();
}

/** Flat, sorted list of every file path under `root`, relative to it. Directories excluded. */
export function listFiles(root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string, prefix: string) => {
        for (const entry of fs.readdirSync(dir)) {
            const full = `${dir}/${entry}`;
            const rel = prefix ? `${prefix}/${entry}` : entry;
            if (fs.statSync(full).isDirectory()) {
                walk(full, rel);
            } else {
                found.push(rel);
            }
        }
    };
    walk(root, "");
    return found.sort();
}

/**
 * Resets the fixture elements *in place*. Replacing `document.body.innerHTML` would detach the
 * nodes `src/snippets.ts` captured at import time, so the module would keep writing to orphans.
 */
export function resetDom() {
    const select = codeSelect();
    select.length = 0;
    select.options[0] = new Option("Select a code snippet", "0");
    (document.getElementById("file-system") as HTMLDivElement).innerHTML = "";
    (document.querySelector(".folder-structure") as HTMLDivElement)
        .querySelectorAll("li")
        .forEach((li) => li.remove());
    (document.getElementById("image-panel") as HTMLDivElement).style.display = "";
    (document.getElementById("image-preview") as HTMLImageElement).src = "";
}

export function codeSelect(): HTMLSelectElement {
    return document.getElementById("code-selector") as HTMLSelectElement;
}

/** Option texts excluding the placeholder at index 0. */
export function selectorNames(): string[] {
    return Array.from(codeSelect().options)
        .slice(1)
        .map((option) => option.text);
}

/** Builds a snippet tree directly, bypassing the functions under test. */
export function writeTree(codeId: string, files: Record<string, string | Uint8Array>) {
    for (const [path, content] of Object.entries(files)) {
        const full = `/code/${codeId}/${path}`;
        const dir = full.slice(0, full.lastIndexOf("/"));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(full, content as never);
    }
}
