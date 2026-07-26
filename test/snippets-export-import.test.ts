/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "@zenfs/core";
import { saveAs } from "file-saver";
import Toastify from "toastify-js";
import { listFiles, resetDom, resetFs, writeTree } from "./fs-helpers";
import { clearCreatedBlobs, lastCreatedBlob } from "./setup";
import {
    codeSnippetExists,
    exportAllCode,
    exportCodeSnippet,
    importCodeSnippet,
    readFileContent,
    saveCodeSnippetMaster,
} from "../src/snippets";

const ID = "aaaaaaaaaa";
const OTHER_ID = "bbbbbbbbbb";
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 253, 254, 255]);

interface Envelope {
    [id: string]: { name: string; files: Record<string, string> };
}

/** The JSON the export helpers handed to the browser. */
async function exportedJson(blob: Blob): Promise<Envelope> {
    return JSON.parse(await blob.text());
}

/** Drives `importCodeSnippet()` by standing in for the file picker. */
function importFile(name: string, contents: string): Promise<void> {
    const file = new File([contents], name, { type: "application/json" });
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
        this: HTMLInputElement
    ) {
        Object.defineProperty(this, "files", { value: [file], configurable: true });
        this.dispatchEvent(new Event("change"));
    });
    return importCodeSnippet();
}

function toastTexts(): string[] {
    return vi.mocked(Toastify).mock.calls.map((call) => String(call[0]?.text ?? ""));
}

describe("export and import", () => {
    beforeEach(async () => {
        await resetFs();
        resetDom();
        clearCreatedBlobs();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("exportCodeSnippet", () => {
        it("wraps the snippet in the { id: { name, files } } envelope", async () => {
            writeTree(ID, {
                ".snippet": "My Code",
                "source/main.brs": "print 1",
                "components/scene.xml": "<component />",
            });

            exportCodeSnippet(ID);

            const [[blob, filename]] = vi.mocked(saveAs).mock.calls;
            const envelope = await exportedJson(blob as Blob);
            expect(filename).toBe("my-code.json");
            expect(envelope[ID].name).toBe("My Code");
            expect(envelope[ID].files).toEqual({
                "source/main.brs": "print 1",
                "components/scene.xml": "<component />",
            });
        });

        it("excludes dotfiles, so .snippet does not become a project file", async () => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");

            exportCodeSnippet(ID);

            const envelope = await exportedJson(vi.mocked(saveAs).mock.calls[0][0] as Blob);
            expect(Object.keys(envelope[ID].files)).toEqual(["source/main.brs"]);
        });

        it("inlines images as base64 data URIs", async () => {
            writeTree(ID, {
                ".snippet": "My Code",
                "source/main.brs": "print 1",
                "images/logo.png": PNG_BYTES,
            });

            exportCodeSnippet(ID);

            const envelope = await exportedJson(vi.mocked(saveAs).mock.calls[0][0] as Blob);
            const encoded = envelope[ID].files["images/logo.png"];
            expect(encoded).toMatch(/^data:image\/png;base64,/);
            expect([...Buffer.from(encoded.split(",")[1], "base64")]).toEqual([...PNG_BYTES]);
        });

        it("builds a filesystem-safe file name", async () => {
            saveCodeSnippetMaster(ID, "Hello World (SceneGraph)", "print 1");

            exportCodeSnippet(ID);

            expect(vi.mocked(saveAs).mock.calls[0][1]).toBe("hello-world-scenegraph.json");
        });

        it("reports a missing snippet instead of exporting an empty file", () => {
            exportCodeSnippet("zzzzzzzzzz");

            expect(saveAs).not.toHaveBeenCalled();
            expect(toastTexts().join()).toContain("Code snippet not found");
        });
    });

    describe("exportAllCode", () => {
        beforeEach(() => {
            // exportAllCode() downloads via a synthetic <a>; jsdom logs "Not implemented:
            // navigation to another Document" when it is clicked for real.
            vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        });

        it("includes every snippet keyed by id", async () => {
            saveCodeSnippetMaster(ID, "First", "print 1");
            saveCodeSnippetMaster(OTHER_ID, "Second", "print 2");

            exportAllCode();

            const envelope = await exportedJson(lastCreatedBlob());
            expect(Object.keys(envelope).sort()).toEqual([ID, OTHER_ID].sort());
            expect(envelope[ID].name).toBe("First");
            expect(envelope[OTHER_ID].files["source/main.brs"]).toBe("print 2");
        });

        it("skips directories that are not snippets", async () => {
            saveCodeSnippetMaster(ID, "First", "print 1");
            fs.mkdirSync("/code/not-a-snippet-dir");

            exportAllCode();

            expect(Object.keys(await exportedJson(lastCreatedBlob()))).toEqual([ID]);
        });
    });

    describe("importCodeSnippet", () => {
        it("restores a snippet from an exported envelope", async () => {
            const envelope: Envelope = {
                [ID]: {
                    name: "Imported",
                    files: {
                        "source/main.brs": "print 1",
                        "components/scene.xml": "<component />",
                        manifest: "title=Imported",
                    },
                },
            };

            await importFile("codesnippets.json", JSON.stringify(envelope));

            expect(codeSnippetExists(ID)).toBe(true);
            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Imported");
            expect(readFileContent(`/code/${ID}/components/scene.xml`)).toBe("<component />");
            expect(listFiles(`/code/${ID}`)).toEqual([
                ".snippet",
                "components/scene.xml",
                "manifest",
                "source/main.brs",
            ]);
        });

        it("round-trips a snippet with images, bytes intact", async () => {
            writeTree(ID, {
                ".snippet": "With Images",
                "source/main.brs": "print 1",
                "images/logo.png": PNG_BYTES,
            });
            exportCodeSnippet(ID);
            const json = await (vi.mocked(saveAs).mock.calls[0][0] as Blob).text();

            await resetFs();
            await importFile("with-images.json", json);

            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("With Images");
            expect([...fs.readFileSync(`/code/${ID}/images/logo.png`)]).toEqual([...PNG_BYTES]);
        });

        it("imports a bare .brs file as a new snippet named after the file", async () => {
            await importFile("my-sketch.brs", "sub main()\n    print 1\nend sub");

            const ids = fs.readdirSync("/code").filter((entry) => entry.length === 10);
            expect(ids).toHaveLength(1);
            expect(readFileContent(`/code/${ids[0]}/.snippet`)).toBe("my-sketch.brs");
            expect(readFileContent(`/code/${ids[0]}/source/main.brs`)).toContain("print 1");
        });

        it("imports several snippets from one file", async () => {
            const envelope: Envelope = {
                [ID]: { name: "First", files: { "source/main.brs": "print 1" } },
                [OTHER_ID]: { name: "Second", files: { "source/main.brs": "print 2" } },
            };

            await importFile("codesnippets.json", JSON.stringify(envelope));

            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("First");
            expect(readFileContent(`/code/${OTHER_ID}/.snippet`)).toBe("Second");
        });

        it("rejects malformed JSON and reports it", async () => {
            await expect(importFile("broken.json", "{ not json")).rejects.toThrow();

            expect(toastTexts().join()).toContain("Failed to import code snippets");
            expect(fs.readdirSync("/code")).toHaveLength(0);
        });

        it("rejects when no file is chosen", async () => {
            vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
                this: HTMLInputElement
            ) {
                Object.defineProperty(this, "files", { value: [], configurable: true });
                this.dispatchEvent(new Event("change"));
            });

            await expect(importCodeSnippet()).rejects.toThrow("No file selected");
        });
    });
});
