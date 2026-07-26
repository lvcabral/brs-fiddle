/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// jsdom has no IndexedDB; this installs `indexedDB`, `IDBFactory` and friends as globals.
// Must come before anything that touches the storage layer.
import "fake-indexeddb/auto";
import { Buffer as NodeBuffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";

// jsdom lives in its own V8 realm, so `globalThis.ArrayBuffer` and `globalThis.Uint8Array` are
// not the constructors that Node's Buffer and undici's `Response.arrayBuffer()` produce values
// from. ZenFS branches on `instanceof` in places -- notably `getSource()` in @zenfs/archives,
// which rejects a foreign ArrayBuffer and makes every template load fail -- so the binary
// globals are realigned with Node's. Both assignments are required: dropping either one fails
// 15 template tests. This is purely a test environment artifact; a browser has a single realm.
globalThis.Uint8Array = Object.getPrototypeOf(NodeBuffer) as Uint8ArrayConstructor;
globalThis.ArrayBuffer = NodeBuffer.from("").buffer.constructor as ArrayBufferConstructor;

// `src/snippets.ts` captures its DOM handles at module scope, so the fixture has to be in
// place before that module is imported. Setup files run before the test file is evaluated.
installDomFixture();

// Toastify manipulates the DOM and schedules timers on every message. Stubbing the module
// keeps `showToast()` in src/util.ts real (and spy-able) without the noise.
vi.mock("toastify-js", () => ({
    default: vi.fn(() => ({ showToast: vi.fn() })),
}));

vi.mock("file-saver", () => ({
    saveAs: vi.fn(),
}));

// jsdom implements neither of these. The blobs are kept so tests can read back what the export
// helpers handed to the browser.
const createdBlobs: Blob[] = [];
globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
    createdBlobs.push(blob);
    return `blob:mock/${createdBlobs.length}`;
});
globalThis.URL.revokeObjectURL = vi.fn();

/** The most recent blob passed to `URL.createObjectURL()`. */
export function lastCreatedBlob(): Blob {
    return createdBlobs[createdBlobs.length - 1];
}

export function clearCreatedBlobs() {
    createdBlobs.length = 0;
}

/**
 * The elements `src/snippets.ts` looks up at import time. The `<select>` keeps a placeholder
 * option at index 0 to match the `optionsOffset` that `populateCodeSelector()` assumes.
 */
export function installDomFixture() {
    document.body.innerHTML = `
        <select id="code-selector">
            <option value="0">Select a code snippet</option>
        </select>
        <div class="folder-structure">
            <div id="file-system"></div>
        </div>
        <div id="image-panel"><img id="image-preview" /></div>
    `;
}

const TEMPLATE_DIR = resolve(__dirname, "../src/templates");

/**
 * Serves `./templates/<file>` requests out of the real `src/templates/` directory, so template
 * tests run against the files that actually ship. Anything else 404s, which keeps the
 * missing-template branches in `loadZipTemplate()` / `loadBrsTemplate()` reachable.
 */
export function installFetchStub() {
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        const match = /templates\/([^/?#]+)$/.exec(url);
        if (match) {
            try {
                const data = readFileSync(resolve(TEMPLATE_DIR, match[1]));
                return new Response(new Uint8Array(data), { status: 200 });
            } catch {
                // fall through to the 404 below
            }
        }
        return new Response(null, { status: 404, statusText: "Not Found" });
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;
    return fetchStub;
}

/** Reads a template file straight from disk, for comparing against what landed in ZenFS. */
export function readTemplateFile(name: string): Buffer {
    return readFileSync(resolve(TEMPLATE_DIR, name));
}

installFetchStub();
