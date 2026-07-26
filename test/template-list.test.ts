/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { readTemplateFile } from "./setup";
import { templates } from "../src/template-list";

const TEMPLATE_DIR = resolve(__dirname, "../src/templates");

/**
 * The registry drives the templates menu and the file names are fetched at runtime, so a typo
 * only shows up as a "template is missing" toast in production. These checks catch it at build.
 */
describe("template registry", () => {
    it("is not empty", () => {
        expect(templates.length).toBeGreaterThan(0);
    });

    it.each(templates)("$name points at a file that exists", ({ path }) => {
        expect(existsSync(resolve(TEMPLATE_DIR, path))).toBe(true);
    });

    it("only registers .brs and .zip files", () => {
        const bad = templates.filter((t) => !/\.(brs|zip)$/.test(t.path));
        expect(bad).toEqual([]);
    });

    it("has unique names", () => {
        // A duplicate name makes codeNameExists() reject the second template silently.
        const names = templates.map((t) => t.name);
        expect(names).toHaveLength(new Set(names).size);
    });

    it("has unique paths", () => {
        const paths = templates.map((t) => t.path);
        expect(paths).toHaveLength(new Set(paths).size);
    });

    it("does not ship template files that nothing can reach", () => {
        const registered = new Set(templates.map((t) => t.path));
        const onDisk = readdirSync(TEMPLATE_DIR).filter((name) => /\.(brs|zip)$/.test(name));
        const orphans = onDisk.filter((name) => !registered.has(name));

        expect(orphans).toEqual([]);
    });

    describe("packaged templates", () => {
        const zipTemplates = templates.filter((t) => t.path.endsWith(".zip"));

        it.each(zipTemplates)("$path is a valid Roku project", ({ path }) => {
            const entries = Object.keys(unzipSync(new Uint8Array(readTemplateFile(path))));

            // hasManifest() routes these through the packaged-app path; without a manifest the
            // template would load into the editor but fail to run.
            expect(entries).toContain("manifest");
            expect(entries).toContain("source/main.brs");
        });
    });

    describe("source templates", () => {
        const brsTemplates = templates.filter((t) => t.path.endsWith(".brs"));

        it.each(brsTemplates)("$path declares a main entry point", ({ path }) => {
            const source = readTemplateFile(path).toString("utf-8");
            expect(source.toLowerCase()).toMatch(/sub\s+main|function\s+main/);
        });
    });
});
