/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "@zenfs/core";
import Toastify from "toastify-js";
import { listFiles, remountFs, resetDom, resetFs, writeTree } from "./fs-helpers";
import {
    codeNameExists,
    codeSnippetExists,
    deleteCodeSnippet,
    hasManifest,
    highlightSelectedFile,
    loadCodeSnippet,
    populateCodeSelector,
    readFileContent,
    renameCodeSnippet,
    saveCodeSnippet,
    saveCodeSnippetAs,
    saveCodeSnippetMaster,
} from "../src/snippets";

const ID = "aaaaaaaaaa";
const OTHER_ID = "bbbbbbbbbb";

/** Points the module-scoped `currSelectedPath` at `path`, the way a file-tree click would. */
function selectFile(path: string) {
    const li = document.createElement("li");
    if (path) {
        li.dataset.path = path;
    }
    highlightSelectedFile(li);
}

function toastTexts(): string[] {
    return vi.mocked(Toastify).mock.calls.map((call) => String(call[0]?.text ?? ""));
}

describe("snippet persistence", () => {
    beforeEach(async () => {
        await resetFs();
        resetDom();
        selectFile(""); // module state leaks between tests; start from a known point
    });

    describe("saveCodeSnippetMaster", () => {
        it("creates the standard snippet layout", () => {
            saveCodeSnippetMaster(ID, "My Code", "sub main()\nend sub");

            expect(listFiles(`/code/${ID}`)).toEqual([".snippet", "source/main.brs"]);
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("sub main()\nend sub");
        });

        it("stores the display name in .snippet, separate from the code", () => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");

            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("My Code");
            expect(readFileContent(`/code/${ID}/.snippet`)).not.toContain("print 1");
        });

        it("reports an error instead of throwing when the snippet already exists", () => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");

            expect(() => saveCodeSnippetMaster(ID, "My Code", "print 2")).not.toThrow();
            expect(toastTexts().join()).toContain("Error saving code snippet");
            // the original content survives the failed overwrite
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
        });
    });

    describe("saveCodeSnippet", () => {
        it("writes to the file selected in the tree", () => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");
            loadCodeSnippet(ID); // seeds currSelectedPath from the generated tree

            expect(saveCodeSnippet(ID, "print 2")).toBe(true);
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 2");
        });

        it("follows the file-tree selection to a non-entry-point file", () => {
            writeTree(ID, {
                ".snippet": "My Code",
                "source/main.brs": "print 1",
                "components/scene.brs": "' scene",
            });
            selectFile("components/scene.brs");

            expect(saveCodeSnippet(ID, "' edited")).toBe(true);
            expect(readFileContent(`/code/${ID}/components/scene.brs`)).toBe("' edited");
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
        });

        it("refuses to save when no file is selected, rather than corrupting the snippet", () => {
            // `currSelectedPath` is "" until loadCodeSnippet()/highlightSelectedFile() runs, which
            // makes the target the snippet directory itself -- existsSync() says true for it.
            saveCodeSnippetMaster(ID, "My Code", "print 1");

            expect(saveCodeSnippet(ID, "print 2")).toBe(false);
            expect(toastTexts().join()).toContain("Error saving code snippet");
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
        });

        it("reports a missing target file", () => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");
            selectFile("source/gone.brs");

            expect(saveCodeSnippet(ID, "print 2")).toBe(false);
            expect(toastTexts().join()).toContain("File not found");
        });
    });

    describe("saveCodeSnippetAs", () => {
        it("deep-copies the whole tree under a new id and name", () => {
            writeTree(ID, {
                ".snippet": "Original",
                "source/main.brs": "print 1",
                "components/scene.xml": "<component />",
                manifest: "title=Original",
            });

            expect(saveCodeSnippetAs(ID, OTHER_ID, "Original (Copy)")).toBe(true);
            expect(listFiles(`/code/${OTHER_ID}`)).toEqual(listFiles(`/code/${ID}`));
            expect(readFileContent(`/code/${OTHER_ID}/.snippet`)).toBe("Original (Copy)");
            expect(readFileContent(`/code/${OTHER_ID}/components/scene.xml`)).toBe("<component />");
        });

        it("leaves the source snippet untouched", () => {
            saveCodeSnippetMaster(ID, "Original", "print 1");
            saveCodeSnippetAs(ID, OTHER_ID, "Copy");
            selectFile("source/main.brs");
            saveCodeSnippet(OTHER_ID, "print 2");

            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Original");
        });

        it("reports a missing source snippet", () => {
            expect(saveCodeSnippetAs("cccccccccc", OTHER_ID, "Copy")).toBe(false);
            expect(toastTexts().join()).toContain("Code snippet not found");
            expect(fs.existsSync(`/code/${OTHER_ID}`)).toBe(false);
        });
    });

    describe("renameCodeSnippet", () => {
        it("updates the .snippet file and the in-memory name map", () => {
            saveCodeSnippetMaster(ID, "Old Name", "print 1");
            populateCodeSelector(ID); // fills codeMap, which codeNameExists() reads

            renameCodeSnippet(ID, "New Name");

            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("New Name");
            expect(codeNameExists("New Name")).toBe(ID);
            expect(codeNameExists("Old Name")).toBeUndefined();
        });

        it("does not move the snippet directory", () => {
            saveCodeSnippetMaster(ID, "Old Name", "print 1");
            renameCodeSnippet(ID, "New Name");

            expect(codeSnippetExists(ID)).toBe(true);
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
        });
    });

    describe("deleteCodeSnippet", () => {
        it("removes a nested tree completely", () => {
            writeTree(ID, {
                ".snippet": "My Code",
                "source/main.brs": "print 1",
                "components/nested/deep.brs": "' deep",
                "images/logo.png": new Uint8Array([137, 80, 78, 71]),
                manifest: "title=My Code",
            });

            deleteCodeSnippet(ID);

            expect(fs.existsSync(`/code/${ID}`)).toBe(false);
            expect(codeSnippetExists(ID)).toBe(false);
        });

        it("leaves other snippets alone", () => {
            saveCodeSnippetMaster(ID, "One", "print 1");
            saveCodeSnippetMaster(OTHER_ID, "Two", "print 2");

            deleteCodeSnippet(ID);

            expect(codeSnippetExists(OTHER_ID)).toBe(true);
            expect(readFileContent(`/code/${OTHER_ID}/source/main.brs`)).toBe("print 2");
        });

        it("reports a missing snippet instead of throwing", () => {
            expect(() => deleteCodeSnippet("zzzzzzzzzz")).not.toThrow();
            expect(toastTexts().join()).toContain("Code snippet not found");
        });
    });

    describe("existence checks", () => {
        it("codeSnippetExists tracks the directory", () => {
            expect(codeSnippetExists(ID)).toBe(false);
            saveCodeSnippetMaster(ID, "My Code", "print 1");
            expect(codeSnippetExists(ID)).toBe(true);
        });

        it("hasManifest decides how the snippet will be executed", () => {
            saveCodeSnippetMaster(ID, "Draw2D", "print 1");
            writeTree(OTHER_ID, { ".snippet": "SceneGraph", manifest: "title=SceneGraph" });

            expect(hasManifest(ID)).toBe(false);
            expect(hasManifest(OTHER_ID)).toBe(true);
        });

        // Returns the id rather than a boolean so callers can switch to the
        // snippet that already owns the name instead of just rejecting it.
        it("codeNameExists returns the matching id, and only what populateCodeSelector last loaded", () => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");

            expect(codeNameExists("My Code")).toBeUndefined(); // codeMap not populated yet
            populateCodeSelector(ID);
            expect(codeNameExists("My Code")).toBe(ID);
            expect(codeNameExists("Missing")).toBeUndefined();
        });
    });

    describe("durability", () => {
        it("survives a remount, proving the data reached localStorage", async () => {
            writeTree(ID, {
                ".snippet": "My Code",
                "source/main.brs": "print 1",
                "images/logo.png": new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
            });

            await remountFs(); // same localStorage, fresh ZenFS instance -- i.e. a page reload

            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("My Code");
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
            expect([...fs.readFileSync(`/code/${ID}/images/logo.png`)]).toEqual([
                137, 80, 78, 71, 13, 10, 26, 10,
            ]);
        });

        it("a deletion is durable too", async () => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");
            deleteCodeSnippet(ID);

            await remountFs();

            expect(codeSnippetExists(ID)).toBe(false);
        });
    });
});
