/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { afterEach, describe, expect, it, vi } from "vitest";
import Toastify from "toastify-js";
import {
    arrayBufferToBase64,
    calculateLocalStorageUsage,
    generateId,
    getFileExtension,
    getIcon,
    getImageUrlFromArrBuffer,
    getMimeType,
    getOS,
    isFirefox,
    isImageFile,
    logStorageUsage,
    requestPersistentStorage,
    showToast,
} from "../src/util";

describe("generateId", () => {
    it("produces 10-character ids", () => {
        // The length is load-bearing: /code enumeration treats any 10-character entry as a
        // snippet, and the v1.x migration scans localStorage for 10-character keys.
        expect(generateId()).toHaveLength(10);
    });

    it("does not repeat", () => {
        const ids = new Set(Array.from({ length: 500 }, () => generateId()));
        expect(ids.size).toBe(500);
    });
});

describe("getFileExtension", () => {
    it.each([
        ["main.brs", "brs"],
        ["scene.xml", "xml"],
        ["logo.PNG", "PNG"],
        ["archive.tar.gz", "gz"],
    ])("%s -> %s", (input, expected) => {
        expect(getFileExtension(input)).toBe(expected);
    });

    it("returns an empty string for an extensionless file", () => {
        // `manifest` is the case that matters: index.ts maps "" to the ini editor mode.
        expect(getFileExtension("manifest")).toBe("");
    });

    it("treats a dotfile as extensionless", () => {
        expect(getFileExtension(".snippet")).toBe("");
    });

    it("returns an empty string for a trailing dot", () => {
        expect(getFileExtension("weird.")).toBe("");
    });
});

describe("isImageFile", () => {
    it.each(["logo.png", "photo.JPG", "shot.jpeg", "anim.gif", "old.bmp", "new.webp"])(
        "%s is an image",
        (name) => {
            expect(isImageFile(name)).toBe(true);
        }
    );

    it.each(["main.brs", "scene.xml", "manifest", ".snippet", "notes.txt"])(
        "%s is not an image",
        (name) => {
            expect(isImageFile(name)).toBe(false);
        }
    );
});

describe("getIcon", () => {
    it("uses the image icon for images", () => {
        expect(getIcon("logo.png")).toBe("icon-file-image");
    });

    it("uses the code icon for source files", () => {
        expect(getIcon("main.brs")).toBe("icon-file-code");
        expect(getIcon("scene.xml")).toBe("icon-file-code");
    });

    it("falls back to the document icon", () => {
        expect(getIcon("manifest")).toBe("icon-doc-text");
    });
});

describe("getMimeType", () => {
    it.each([
        ["logo.png", "image/png"],
        ["photo.jpg", "image/jpeg"],
        ["photo.jpeg", "image/jpeg"],
        ["anim.gif", "image/gif"],
        ["old.bmp", "image/bmp"],
        ["new.webp", "image/webp"],
        ["manifest", "application/octet-stream"],
    ])("%s -> %s", (input, expected) => {
        expect(getMimeType(input)).toBe(expected);
    });
});

describe("base64 helpers", () => {
    it("encodes bytes, including non-ASCII ones", () => {
        const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
        expect(arrayBufferToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString("base64"));
    });

    it("encodes an empty buffer", () => {
        expect(arrayBufferToBase64(new Uint8Array([]).buffer)).toBe("");
    });

    it("builds a data URI with the given mime type", () => {
        const bytes = new Uint8Array([1, 2, 3]);
        expect(getImageUrlFromArrBuffer(bytes.buffer, "image/png")).toBe(
            `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`
        );
    });
});

describe("showToast", () => {
    it("uses the success style by default", () => {
        showToast("Saved");

        expect(Toastify).toHaveBeenCalledWith(
            expect.objectContaining({
                text: "Saved",
                duration: 3000,
                className: "toastify-success",
            })
        );
    });

    it("uses the error style when flagged", () => {
        showToast("Broke", 5000, true);

        expect(Toastify).toHaveBeenCalledWith(
            expect.objectContaining({ text: "Broke", duration: 5000, className: "toastify-error" })
        );
    });
});

describe("calculateLocalStorageUsage", () => {
    afterEach(() => {
        localStorage.clear();
    });

    it("reports usage in KB as a 2-decimal string", () => {
        localStorage.clear();
        expect(calculateLocalStorageUsage()).toBe("0.00");

        // Avoid key names that collide with Storage methods ("key", "clear", ...) -- jsdom does
        // not expose those as own properties, so the function would skip them.
        localStorage.setItem("snippet", "x".repeat(1024));
        // (value length + key length) * 2 bytes / 1024
        expect(calculateLocalStorageUsage()).toBe((((1024 + 7) * 2) / 1024).toFixed(2));
    });

    it("adds up multiple entries", () => {
        localStorage.clear();
        localStorage.setItem("aa", "bb");
        localStorage.setItem("cc", "dd");

        expect(calculateLocalStorageUsage()).toBe(((4 * 2 * 2) / 1024).toFixed(2));
    });
});

describe("logStorageUsage", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("reports usage and quota when the browser supports it", async () => {
        vi.stubGlobal("navigator", {
            ...navigator,
            storage: {
                estimate: async () => ({ usage: 2 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
            },
        });

        await expect(logStorageUsage()).resolves.toEqual({
            usage: 2 * 1024 * 1024,
            quota: 100 * 1024 * 1024,
        });
        vi.unstubAllGlobals();
    });

    it("returns null when the Storage API is missing", async () => {
        vi.stubGlobal("navigator", { ...navigator, storage: undefined });

        await expect(logStorageUsage()).resolves.toBeNull();
        vi.unstubAllGlobals();
    });

    it("returns null instead of throwing when estimate() rejects", async () => {
        vi.stubGlobal("navigator", {
            ...navigator,
            storage: {
                estimate: async () => {
                    throw new Error("denied");
                },
            },
        });

        await expect(logStorageUsage()).resolves.toBeNull();
        vi.unstubAllGlobals();
    });
});

describe("isFirefox", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const withUserAgent = (ua: string) => {
        vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);
    };

    it("matches desktop Firefox", () => {
        withUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0");
        expect(isFirefox()).toBe(true);
    });

    it("matches Firefox for Android", () => {
        withUserAgent("Mozilla/5.0 (Android 14; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0");
        expect(isFirefox()).toBe(true);
    });

    it("does not match Firefox on iOS, which runs on WebKit", () => {
        // FxiOS uses WebKit, so it behaves like Safari and must not be gated.
        withUserAgent(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/128.0 Mobile/15E148 Safari/605.1.15"
        );
        expect(isFirefox()).toBe(false);
    });

    it.each([
        [
            "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
        ],
        [
            "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        ],
        [
            "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Edg/140.0",
        ],
    ])("does not match other engines: %s", (ua) => {
        withUserAgent(ua);
        expect(isFirefox()).toBe(false);
    });
});

describe("requestPersistentStorage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const stubStorage = (storage: unknown, userAgent = "Chrome/140.0") => {
        vi.stubGlobal("navigator", { ...navigator, userAgent, storage });
    };

    it("returns false when the Storage API is missing", async () => {
        stubStorage(undefined);
        await expect(requestPersistentStorage()).resolves.toBe(false);
    });

    it("does not re-request when persistence is already granted", async () => {
        const persist = vi.fn();
        stubStorage({ persisted: async () => true, persist });

        await expect(requestPersistentStorage()).resolves.toBe(true);
        expect(persist).not.toHaveBeenCalled();
    });

    it("requests persistence on engines that decide silently", async () => {
        const persist = vi.fn(async () => true);
        stubStorage({ persisted: async () => false, persist });

        await expect(requestPersistentStorage()).resolves.toBe(true);
        expect(persist).toHaveBeenCalledOnce();
    });

    it("passes through a silent denial", async () => {
        stubStorage({ persisted: async () => false, persist: async () => false });

        await expect(requestPersistentStorage()).resolves.toBe(false);
    });

    it("never requests on Firefox, which would show a permission prompt", async () => {
        const persist = vi.fn(async () => true);
        stubStorage({ persisted: async () => false, persist }, "Gecko/20100101 Firefox/141.0");

        await expect(requestPersistentStorage()).resolves.toBe(false);
        expect(persist).not.toHaveBeenCalled();
    });

    it("still reports already-granted persistence on Firefox", async () => {
        // If the user granted it themselves through site permissions, say so.
        stubStorage({ persisted: async () => true, persist: vi.fn() }, "Firefox/141.0");

        await expect(requestPersistentStorage()).resolves.toBe(true);
    });

    it("returns false instead of throwing when the request rejects", async () => {
        stubStorage({
            persisted: async () => false,
            persist: async () => {
                throw new Error("denied");
            },
        });

        await expect(requestPersistentStorage()).resolves.toBe(false);
    });
});

describe("getOS", () => {
    const stub = (platform: string, userAgent: string) => {
        vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
        vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
    };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ["MacIntel", "", "MacOS"],
        ["iPhone", "", "iOS"],
        ["Win32", "", "Windows"],
        ["Linux x86_64", "Mozilla/5.0 (Linux; Android 13)", "Android"],
        ["Linux x86_64", "Mozilla/5.0 (X11; Linux x86_64)", "Linux"],
    ])("platform %s -> %s", (platform, userAgent, expected) => {
        stub(platform, userAgent);
        expect(getOS()).toBe(expected);
    });

    it("returns null for an unrecognised platform", () => {
        stub("PlayStation 5", "Mozilla/5.0");
        expect(getOS()).toBeNull();
    });
});
