/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from "@zenfs/core";
import { initializeFileSystem, STORE_NAME } from "../src/snippets";

/**
 * Unmounts `/code`, closing the IndexedDB connection first.
 *
 * ZenFS never closes the `IDBDatabase` it opens, so unmounting alone leaks the connection and a
 * later `deleteDatabase()` blocks forever. Reach through StoreFS -> IndexedDBStore -> db.
 */
function unmountCode() {
    if (!fs.mounts.has("/code")) {
        return;
    }
    const store = (fs.mounts.get("/code") as any)?.store;
    store?.db?.close?.();
    fs.umount("/code");
}

/**
 * Puts ZenFS back to an empty `/code`, with both backing stores wiped.
 *
 * The unmounts are required: `fs.mount()` throws EINVAL on a mount point that is already in
 * use, so calling `initializeFileSystem()` twice without them fails.
 */
export async function resetFs() {
    if (fs.mounts.has("/mnt/zip")) {
        fs.umount("/mnt/zip");
    }
    unmountCode();
    localStorage.clear();
    await deleteDatabase();
    await initializeFileSystem();
}

function deleteDatabase() {
    return new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(STORE_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
            reject(new Error("deleteDatabase blocked: an IDB connection is still open"));
    });
}

/**
 * Remounts `/code` over the *same* IndexedDB store, simulating a page reload. Used to prove a
 * snippet really persisted rather than living in the backend's in-memory cache.
 */
export async function remountFs() {
    unmountCode();
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
    // Locale pinned so the order these assertions compare against is the same on
    // CI as it is locally; a bare localeCompare() follows the host locale.
    return found.sort((a, b) => a.localeCompare(b, "en"));
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
