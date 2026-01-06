/*---------------------------------------------------------------------------------------------
 *  BrightScript Fiddle (https://github.com/lvcabral/brs-fiddle)
 *
 *  Copyright (c) 2023-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Toastify from "toastify-js";
import { nanoid } from "nanoid";

export function generateId() {
    return nanoid(10);
}

export const getOS = () => {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    let macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"];
    const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
    const iosPlatforms = ["iPhone", "iPad", "iPod"];
    let os = null;
    if (macosPlatforms.includes(platform)) {
        os = "MacOS";
    } else if (iosPlatforms.includes(platform)) {
        os = "iOS";
    } else if (windowsPlatforms.includes(platform)) {
        os = "Windows";
    } else if (/Android/.test(userAgent)) {
        os = "Android";
    } else if (!os && /Linux/.test(platform)) {
        os = "Linux";
    }
    return os;
};

export function isImageFile(fileName: string): boolean {
    const imageExtensions = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];
    const extension = getFileExtension(fileName).toLowerCase();
    return imageExtensions.includes(extension);
}

export function getFileExtension(filename: string): string {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

export function getIcon(filePath: string): string {
    const ext = getFileExtension(filePath).toLowerCase();
    switch (ext) {
        case "png":
        case "jpg":
        case "jpeg":
        case "gif":
        case "bmp":
        case "webp":
            return "icon-file-image";
        case "brs":
        case "xml":
            return "icon-file-code";
        default:
            return "icon-doc-text";
    }
}

export function getMimeType(filePath: string): string {
    const ext = getFileExtension(filePath).toLowerCase();
    switch (ext) {
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "gif":
            return "image/gif";
        case "bmp":
            return "image/bmp";
        case "webp":
            return "image/webp";
        default:
            return "application/octet-stream";
    }
}

export function getImageUrlFromArrBuffer(arrayBuffer: ArrayBufferLike, mimeType: string): string {
    const base64Data = arrayBufferToBase64(arrayBuffer);
    return `data:${mimeType};base64,${base64Data}`;
}

export function arrayBufferToBase64(buffer: ArrayBufferLike) {
    let binary = "";
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function showToast(message: string, duration = 3000, error = false) {
    Toastify({
        text: message,
        duration: duration,
        close: false,
        gravity: "bottom",
        position: "center",
        stopOnFocus: true,
        className: error ? "toastify-error" : "toastify-success",
    }).showToast();
}

export function calculateLocalStorageUsage() {
    let _lsTotal = 0,
        _xLen,
        _x;
    for (_x in localStorage) {
        if (!localStorage.hasOwnProperty(_x)) {
            continue;
        }
        _xLen = (localStorage[_x].length + _x.length) * 2;
        _lsTotal += _xLen;
    }
    console.log("Current Local Storage usage is " + (_lsTotal / 1024).toFixed(2) + " KB");
    return (_lsTotal / 1024).toFixed(2);
}
