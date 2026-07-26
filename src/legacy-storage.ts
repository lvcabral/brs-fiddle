/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from "@zenfs/core";
import { ensureDirectoryExists, isStoragePersistent } from "./snippets";
import { showToast } from "./util";

/**
 * One-time bridge from the pre-2.2 storage layout to the current one.
 *
 * Up to v2.1.7 snippets lived in a ZenFS 1.11.4 filesystem mounted on `localStorage`. ZenFS 2.x
 * uses an incompatible inode format (72 bytes then, 4096 now) and dropped the upgrade path, so
 * the current build cannot read that data at all -- `readdirSync("/code")` throws EIO. This reads
 * the old store with a dynamically imported copy of 1.11.4 and rewrites the snippets into the
 * IndexedDB-backed filesystem.
 *
 * The old `localStorage` bytes are deliberately left untouched. IndexedDB has its own quota, so
 * keeping them costs nothing against the new capacity and leaves a recovery path if this bridge
 * turns out to be wrong. A later release can delete them.
 */

const FS_VERSION_KEY = "brsFiddle.fsVersion";
const CURRENT_FS_VERSION = "2";

/** ZenFS 1.x stored every inode under a purely numeric `localStorage` key. */
const LEGACY_KEY = /^\d+$/;

export function legacyDataPresent(): boolean {
    if (localStorage.getItem(FS_VERSION_KEY) === CURRENT_FS_VERSION) {
        return false;
    }
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && LEGACY_KEY.test(key)) {
            return true;
        }
    }
    return false;
}

export function markStorageMigrated() {
    localStorage.setItem(FS_VERSION_KEY, CURRENT_FS_VERSION);
}

interface LegacySnippet {
    id: string;
    files: Map<string, Uint8Array>;
}

/**
 * Reimplementation of the `WebStorage` store from @zenfs/dom 1.1.5, built against the legacy
 * core so there is exactly one copy of ZenFS 1.x in the module graph. Aliasing the old
 * @zenfs/dom as well would pull in a second, non-identical `StoreFS` class.
 */
function createLegacyStore(legacy: any, storage: Storage) {
    return {
        get name() {
            return "WebStorage";
        },
        clear() {
            storage.clear();
        },
        clearSync() {
            storage.clear();
        },
        async sync() {
            // no-op: writes go straight through
        },
        transaction() {
            return new legacy.SyncMapTransaction(this);
        },
        keys() {
            return Object.keys(storage).map((k) => Number(k));
        },
        get(key: number) {
            const data = storage.getItem(key.toString());
            if (typeof data !== "string") {
                return undefined;
            }
            return legacy.encodeRaw(data);
        },
        set(key: number, data: Uint8Array) {
            storage.setItem(key.toString(), legacy.decodeRaw(data));
        },
        delete(key: number) {
            storage.removeItem(key.toString());
        },
    };
}

async function readLegacySnippets(): Promise<LegacySnippet[]> {
    // Dynamic so webpack splits ZenFS 1.x into its own chunk -- users who are new or already
    // migrated never download it.
    const legacy: any = await import("zenfs-legacy-core");

    const legacyFs = new legacy.StoreFS(createLegacyStore(legacy, localStorage));
    await legacy.configure({
        mounts: { "/code": legacyFs },
        // The old store is our backup; don't let reads write atimes back into it.
        disableUpdateOnRead: true,
    });

    try {
        const snippets: LegacySnippet[] = [];
        for (const id of legacy.readdirSync("/code")) {
            if (id.length !== 10) {
                continue; // matches how the rest of the app identifies a snippet
            }
            const files = new Map<string, Uint8Array>();
            collect(legacy, `/code/${id}`, "", files);
            snippets.push({ id, files });
        }
        return snippets;
    } finally {
        legacy.umount("/code");
    }
}

function collect(legacy: any, dir: string, prefix: string, out: Map<string, Uint8Array>) {
    for (const entry of legacy.readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        const rel = prefix ? `${prefix}/${entry}` : entry;
        if (legacy.statSync(full).isDirectory()) {
            collect(legacy, full, rel, out);
        } else {
            out.set(rel, new Uint8Array(legacy.readFileSync(full)));
        }
    }
}

export interface MigrationResult {
    /** How many snippets were copied into the live filesystem. */
    migrated: number;
    /**
     * Whether that copy actually reached durable storage. False when IndexedDB was unavailable
     * and the session is running on `InMemory` -- the snippets are usable but vanish on reload,
     * so the caller should offer the user a way to export them.
     */
    persisted: boolean;
}

/**
 * Copies any pre-2.2 snippets into the current filesystem. Safe to call on every startup: it
 * does nothing once the marker is set or when there is nothing to migrate.
 *
 * Must run *after* `initializeFileSystem()`, since it writes through the live filesystem.
 */
export async function migrateLegacyStorage(): Promise<MigrationResult> {
    const persisted = isStoragePersistent();
    if (!legacyDataPresent()) {
        return { migrated: 0, persisted };
    }
    try {
        const snippets = await readLegacySnippets();
        let migrated = 0;
        for (const snippet of snippets) {
            if (fs.existsSync(`/code/${snippet.id}`)) {
                continue; // already carried over by an earlier partial run
            }
            for (const [path, content] of snippet.files) {
                const full = `/code/${snippet.id}/${path}`;
                ensureDirectoryExists(full.slice(0, full.lastIndexOf("/")));
                fs.writeFileSync(full, content);
            }
            migrated++;
        }
        if (persisted) {
            markStorageMigrated();
            if (migrated > 0) {
                showToast(`Upgraded storage: ${migrated} code snippet(s) carried over.`, 5000);
            }
        }
        // When storage is not persistent the copy only exists in memory, so the marker stays
        // unset -- otherwise a later session with working storage would skip the migration and
        // the snippets would never come across. The caller warns the user and offers an export.
        return { migrated, persisted };
    } catch (err: any) {
        // Leave the marker unset so a fixed build can retry, and leave the old data in place.
        console.error("Legacy storage migration failed", err);
        showToast(
            `Could not upgrade previously saved snippets: ${err?.message ?? err}`,
            7000,
            true
        );
        return { migrated: 0, persisted };
    }
}
