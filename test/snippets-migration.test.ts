/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import * as fs from "@zenfs/core";
import { codeSelect, resetDom, resetFs, selectorNames } from "./fs-helpers";
import {
    codeSnippetExists,
    populateCodeSelector,
    readFileContent,
    saveCodeSnippetMaster,
    updateCodeSelector,
} from "../src/snippets";

const ID = "aaaaaaaaaa";
const OTHER_ID = "bbbbbbbbbb";

describe("v1.x storage migration", () => {
    beforeEach(async () => {
        await resetFs();
        resetDom();
    });

    // migrateOldSnippets() is private; populateCodeSelector() is the only way in, which is also
    // how the app triggers it.
    it("splits the @=Name=@ prefix into a named snippet", () => {
        localStorage.setItem(ID, "@=Legacy Code=@sub main()\nend sub");

        populateCodeSelector(ID);

        expect(codeSnippetExists(ID)).toBe(true);
        expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Legacy Code");
        expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("sub main()\nend sub");
    });

    it("removes the old flat key once migrated", () => {
        localStorage.setItem(ID, "@=Legacy Code=@print 1");

        populateCodeSelector(ID);

        expect(localStorage.getItem(ID)).toBeNull();
    });

    it("generates a name for unnamed legacy code", () => {
        localStorage.setItem(ID, "print 1");

        populateCodeSelector(ID);

        expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Code #1");
        expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
    });

    it("does not overwrite a snippet that already exists in ZenFS", () => {
        saveCodeSnippetMaster(ID, "Current Name", "print current");
        localStorage.setItem(ID, "@=Stale Name=@print stale");

        populateCodeSelector(ID);

        expect(readFileContent(`/code/${ID}/.snippet`)).toBe("Current Name");
        expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print current");
        expect(localStorage.getItem(ID)).toBeNull(); // stale key still cleaned up
    });

    it("is idempotent across repeated runs", () => {
        localStorage.setItem(ID, "@=Legacy Code=@print 1");

        populateCodeSelector(ID);
        populateCodeSelector(ID);
        populateCodeSelector(ID);

        expect(selectorNames()).toEqual(["Legacy Code"]);
        expect(readFileContent(`/code/${ID}/source/main.brs`)).toBe("print 1");
    });

    it("ignores app keys that are not 10 characters long", () => {
        localStorage.setItem("brsFiddle.state", JSON.stringify({ codeId: ID }));
        localStorage.setItem("brsFiddle.load", ID);

        populateCodeSelector("");

        expect(localStorage.getItem("brsFiddle.state")).not.toBeNull();
        expect(localStorage.getItem("brsFiddle.load")).not.toBeNull();
        expect(selectorNames()).toEqual([]);
    });

    it("keeps live snippet data out of localStorage entirely", () => {
        // Snippets live in IndexedDB now. Both localStorage scanners -- migrateOldSnippets()
        // looking for 10-character keys and legacyDataPresent() looking for numeric ones -- would
        // misread live data as something to migrate, so nothing may leak back into localStorage.
        for (let i = 0; i < 20; i++) {
            saveCodeSnippetMaster(
                `snippet-${i}`.padEnd(10, "x").slice(0, 10),
                `Code ${i}`,
                "print 1"
            );
        }

        const keys = Object.keys(localStorage);
        expect(keys.filter((key) => /^\d+$/.test(key))).toEqual([]);
        expect(keys.filter((key) => key.length === 10)).toEqual([]);
    });
});

describe("code selector", () => {
    beforeEach(async () => {
        await resetFs();
        resetDom();
    });

    it("keeps the placeholder option first", () => {
        saveCodeSnippetMaster(ID, "My Code", "print 1");

        populateCodeSelector(ID);

        expect(codeSelect().options[0].value).toBe("0");
        expect(codeSelect().options).toHaveLength(2);
    });

    it("sorts names case-insensitively", () => {
        saveCodeSnippetMaster("aaaaaaaaa1", "zebra", "print 1");
        saveCodeSnippetMaster("aaaaaaaaa2", "Apple", "print 1");
        saveCodeSnippetMaster("aaaaaaaaa3", "banana", "print 1");

        populateCodeSelector("");

        expect(selectorNames()).toEqual(["Apple", "banana", "zebra"]);
    });

    it("marks the current snippet as selected", () => {
        saveCodeSnippetMaster(ID, "First", "print 1");
        saveCodeSnippetMaster(OTHER_ID, "Second", "print 2");

        populateCodeSelector(OTHER_ID);

        expect(codeSelect().value).toBe(OTHER_ID);
    });

    it("only lists directories whose name is exactly 10 characters", () => {
        saveCodeSnippetMaster(ID, "Valid", "print 1");
        fs.mkdirSync("/code/short");
        fs.mkdirSync("/code/a-much-longer-name");

        populateCodeSelector(ID);

        expect(selectorNames()).toEqual(["Valid"]);
    });

    it("rebuilds the list rather than appending to it", () => {
        saveCodeSnippetMaster(ID, "First", "print 1");
        populateCodeSelector(ID);
        populateCodeSelector(ID);
        populateCodeSelector(ID);

        expect(selectorNames()).toEqual(["First"]);
    });

    describe("unsaved-changes marker", () => {
        beforeEach(() => {
            saveCodeSnippetMaster(ID, "My Code", "print 1");
            saveCodeSnippetMaster(OTHER_ID, "Other Code", "print 2");
            populateCodeSelector(ID);
        });

        it("adds a bullet when the code is dirty", () => {
            updateCodeSelector(ID, true);

            expect(selectorNames()).toContain("• My Code");
        });

        it("strips the bullet when the code is saved", () => {
            updateCodeSelector(ID, true);
            updateCodeSelector(ID, false);

            expect(selectorNames()).toContain("My Code");
            expect(selectorNames().join()).not.toContain("•");
        });

        it("does not stack bullets across repeated toggles", () => {
            for (let i = 0; i < 5; i++) {
                updateCodeSelector(ID, true);
            }

            expect(selectorNames()).toContain("• My Code");
            expect(selectorNames().join()).not.toContain("••");
        });

        it("only marks the matching snippet", () => {
            updateCodeSelector(ID, true);

            expect(selectorNames()).toContain("Other Code");
        });
    });
});
