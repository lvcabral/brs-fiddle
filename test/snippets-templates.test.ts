/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "@zenfs/core";
import { unzipSync } from "fflate";
import Toastify from "toastify-js";
import { listFiles, resetDom, resetFs } from "./fs-helpers";
import { readTemplateFile } from "./setup";
import {
    createZipFromCodeSnippet,
    hasManifest,
    loadBrsTemplate,
    loadZipTemplate,
    readFileContent,
} from "../src/snippets";
import { templates } from "../src/template-list";

const ID = "aaaaaaaaaa";
const OTHER_ID = "bbbbbbbbbb";

const zipTemplates = templates.filter((t) => t.path.endsWith(".zip"));
const brsTemplates = templates.filter((t) => t.path.endsWith(".brs"));

/** The template zip as it sits on disk, for comparing against what landed in ZenFS. */
function entriesOnDisk(file: string): Record<string, Uint8Array> {
    return unzipSync(new Uint8Array(readTemplateFile(file)));
}

function toastTexts(): string[] {
    return vi.mocked(Toastify).mock.calls.map((call) => String(call[0]?.text ?? ""));
}

describe("template management", () => {
    beforeEach(async () => {
        await resetFs();
        resetDom();
    });

    describe("loadBrsTemplate", () => {
        it("stores a .brs template as a single-file snippet", async () => {
            await loadBrsTemplate(ID, "Hello World (Draw2D)", "hello-world.brs");

            expect(listFiles(`/code/${ID}`)).toEqual([".snippet", "source/main.brs"]);
            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Hello World (Draw2D)");
            expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe(
                readTemplateFile("hello-world.brs").toString("utf-8")
            );
        });

        it("leaves nothing behind when the template file is missing", async () => {
            await loadBrsTemplate(ID, "Nope", "does-not-exist.brs");

            expect(fs.existsSync(`/code/${ID}`)).toBe(false);
            expect(toastTexts().join()).toContain("The template is missing: Nope");
        });
    });

    describe("loadZipTemplate", () => {
        it("replicates the full project tree and names the snippet", async () => {
            await loadZipTemplate(ID, "Hello World (SceneGraph)", "hello-world.zip");

            const extracted = listFiles(`/code/${ID}`);
            const expected = Object.keys(entriesOnDisk("hello-world.zip"))
                .filter((name) => !name.endsWith("/"))
                .concat(".snippet")
                .sort();

            expect(extracted).toEqual(expected);
            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Hello World (SceneGraph)");
            expect(readFileContent(`/code/${ID}/manifest`)).toContain("title=");
        });

        it("preserves binary files byte-for-byte", async () => {
            await loadZipTemplate(ID, "Hello World (SceneGraph)", "hello-world.zip");

            const onDisk = entriesOnDisk("hello-world.zip");
            const images = Object.keys(onDisk).filter((name) => name.endsWith(".png"));
            expect(images.length).toBeGreaterThan(0);

            for (const image of images) {
                const stored = new Uint8Array(fs.readFileSync(`/code/${ID}/${image}`));
                expect(stored.length, image).toBe(onDisk[image].length);
                expect([...stored], image).toEqual([...onDisk[image]]);
            }
        });

        it("can load a second template afterwards (the zip mount is reused)", async () => {
            await loadZipTemplate(ID, "Hello World (SceneGraph)", "hello-world.zip");
            await loadZipTemplate(OTHER_ID, "Simple Task (SceneGraph)", "simple-task.zip");

            expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Hello World (SceneGraph)");
            expect(readFileContent(`/code/${OTHER_ID}/.snippet`)).toBe("Simple Task (SceneGraph)");
            expect(fs.existsSync(`/code/${OTHER_ID}/source/main.brs`)).toBe(true);
        });

        it("leaves nothing behind when the template file is missing", async () => {
            await loadZipTemplate(ID, "Nope", "does-not-exist.zip");

            expect(fs.existsSync(`/code/${ID}`)).toBe(false);
            expect(toastTexts().join()).toContain("The template is missing: Nope");
        });
    });

    describe("run mode", () => {
        it.each(brsTemplates)(
            "$name runs as plain source (no manifest)",
            async ({ name, path }) => {
                await loadBrsTemplate(ID, name, path);
                expect(hasManifest(ID)).toBe(false);
            }
        );

        it.each(zipTemplates)("$name runs as a packaged app (has manifest)", async (template) => {
            await loadZipTemplate(ID, template.name, template.path);
            expect(hasManifest(ID)).toBe(true);
            expect(fs.existsSync(`/code/${ID}/source/main.brs`)).toBe(true);
        });
    });

    describe("createZipFromCodeSnippet", () => {
        it("produces a readable zip containing the project files", async () => {
            await loadZipTemplate(ID, "Hello World (SceneGraph)", "hello-world.zip");

            const zipped = createZipFromCodeSnippet(ID);
            expect(zipped).not.toBeNull();

            const repacked = unzipSync(zipped as Uint8Array);
            expect(Object.keys(repacked)).toContain("manifest");
            expect(Object.keys(repacked)).toContain("source/main.brs");
        });

        it("excludes the .snippet metadata file from the package", async () => {
            await loadZipTemplate(ID, "Hello World (SceneGraph)", "hello-world.zip");

            const repacked = unzipSync(createZipFromCodeSnippet(ID) as Uint8Array);

            expect(Object.keys(repacked)).not.toContain(".snippet");
            expect(Object.keys(repacked).join()).not.toContain("Hello World (SceneGraph)");
        });

        it("round-trips image bytes through the packaging step", async () => {
            await loadZipTemplate(ID, "Hello World (SceneGraph)", "hello-world.zip");

            const onDisk = entriesOnDisk("hello-world.zip");
            const repacked = unzipSync(createZipFromCodeSnippet(ID) as Uint8Array);
            const images = Object.keys(onDisk).filter((name) => name.endsWith(".png"));

            for (const image of images) {
                expect([...repacked[image]], image).toEqual([...onDisk[image]]);
            }
        });

        it("carries edits made after the template was loaded", async () => {
            await loadZipTemplate(ID, "Hello World (SceneGraph)", "hello-world.zip");
            fs.writeFileSync(`/code/${ID}/source/main.brs`, "sub main()\n    print 42\nend sub");

            const repacked = unzipSync(createZipFromCodeSnippet(ID) as Uint8Array);

            expect(new TextDecoder().decode(repacked["source/main.brs"])).toContain("print 42");
        });
    });
});
