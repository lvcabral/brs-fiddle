# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`brsFiddle.net` — a browser-only BrightScript (Roku) code playground. There is no backend: code runs in the browser via the `brs-engine` simulation engine, and snippets are stored in `localStorage` through a virtual filesystem.

## Commands

```bash
npm install          # setup
npm run build        # development build -> app/
npm run release      # production (minified) build -> app/
npm start            # webpack dev server on http://localhost:8500 (opens browser)
npm test             # vitest, single run
npm run test:watch   # vitest in watch mode
npm run test:coverage
npm run lint         # tslint (legacy config, still the linter of record)
npm run prettier     # check formatting; `npm run prettier:write` to fix
npm run clean        # rimraf ./types ./app
```

Single file: `npx vitest run test/snippets-save.test.ts`. Single test: `npx vitest run -t "deep-copies"`.

`npm run lint` reports 6 **pre-existing** errors (`src/index.ts`, `src/util.ts`, `src/editor/`), and `src/index.ts` + `src/editor/codemirror.ts` are not Prettier-clean. Both were already true on `master`, which is why CI runs tests and the build but not lint — check against `master` before treating either as your regression.

`app/` is the build output and is gitignored — never edit files there; edit `src/` and rebuild.

Formatting is Prettier with 4-space tabs, `printWidth: 100`, `trailingComma: "es5"` (configured inline in `package.json`).

## Architecture

### Runtime composition

The page is assembled at build time from three separately-loaded pieces:

- `src/index.ejs` → `app/index.html` via HtmlWebpackPlugin. It hardcodes every DOM element the app uses and loads `lib/brs.api.js` and `coi-serviceworker.min.js` as plain `<script>` tags.
- `brs-engine` is a **webpack external** mapped to the global `brs` (`externals: { "brs-engine": "brs" }`). `import * as brs from "brs-engine"` resolves to that global at runtime, not to a bundled module. `brs.api.js`, `brs.worker.js`, and `brs-sg.js` (the SceneGraph extension from `brs-scenegraph`) are copied into `app/lib/` by CopyWebpackPlugin.
- `src/index.ts` → `app/lib/brsFiddle.js`, the app itself.

`SharedArrayBuffer` is required by the engine, so the page must be cross-origin isolated. The dev server sets COOP/COEP headers; GitHub Pages can't, so `coi-serviceworker` installs a service worker that adds them. Anything that breaks isolation breaks execution entirely.

### `src/index.ts` — the orchestrator (~1150 lines)

Everything UI-level lives here: it grabs all DOM handles at module scope from `index.ejs`, wires buttons/hotkeys/dialogs, drives engine lifecycle, and persists UI state. Adding a control means editing both `src/index.ejs` and the handle block at the top of `index.ts`.

Notable behaviors:

- **State** persists under `localStorage["brsFiddle.state"]` (`loadState`/`saveState`): selected snippet id, audio/keyboard/gamepad switches, dark theme, file-tree visibility, indentation type/size.
- **Engine events** arrive through `brs.subscribe(appId, handleEngineEvents)` — `loaded`/`started`/`debug`/`closed`/`error` toggle the Run/Break/Resume/End buttons and pipe debug output into the `@lvcabral/terminal` console. Terminal input that the terminal doesn't handle is forwarded to `brs.debug(...)`.
- **Share links** compress `[id, code]` with `json-url`'s LZMA codec into a `?code=` query param. When a snippet has a name it is prefixed inline as `@=Name=@<code>`. Decoding writes into `localStorage` and reloads the base URL. Links over 2048 bytes warn the user.
- **Templates** are declared in `src/template-list.ts`, with files under `src/templates/` (copied to `app/templates/` and fetched at runtime). `.brs` templates load as a single source file; `.zip` templates are full projects. A new template must be added to both places — `test/template-list.test.ts` fails if the registry and the directory drift apart.
- **Layout** is manually managed: `resizeCanvas` keeps the display canvas 16:9, the drag separator resizes the code column, and `editorManager.layout()` must be called after any size change.

### Editors — `src/editor/`

Two editor backends behind the `IEditorManager` interface (`editor/types.ts`), chosen by platform in `initializeCodeEditor()`:

- **Monaco** (`monaco.ts`) on desktop — replaces the `#brsCode` textarea with a generated `#monacoEditor` div.
- **CodeMirror 5** (`codemirror.ts`) on iOS/Android — attaches to the textarea directly.

BrightScript syntax support is implemented **twice**, once per backend: `brightscript-monaco.ts` (Monarch tokenizer + theme, derived from the RokuCommunity VS Code extension grammar) and `brightscript-codemirror.ts` (CodeMirror mode). Language changes generally need to be mirrored in both. `MonacoWebpackPlugin` only ships the `xml` and `ini` built-in languages — BrightScript is registered at runtime — so adding a language mode requires updating `webpack.config.js`.

Editor modes map from file extension in `loadFile()`: `.brs` → `brightscript`, `.xml` → `xml`, extensionless (i.e. `manifest`) → `ini`.

### Storage — `src/snippets.ts`

ZenFS provides a Node-like `fs` API in the browser. `/code` is mounted on the **`IndexedDB`** backend (database `brsFiddle`, see `STORE_NAME`); template zips are temporarily mounted at `/mnt/zip` via the `Zip` backend and copied out.

**Everything in `src/snippets.ts` is synchronous even though IndexedDB is async.** `IndexedDB.create()` preloads the whole store into an in-memory cache before resolving, and sync writes are queued back to IDB. That only holds because `main()` awaits `initializeFileSystem()` before the first read — do not call any `fs.*Sync` before it resolves. Where IndexedDB is unavailable, `initializeFileSystem()` falls back to `InMemory` and toasts a warning; `isStoragePersistent()` reports which happened.

ZenFS never closes the `IDBDatabase` it opens, so anything that unmounts `/code` must close it first or a later `deleteDatabase()` blocks forever — see `unmountCode()` in `test/fs-helpers.ts`.

After mounting, `initializeFileSystem()` calls `requestPersistentStorage()` (`src/util.ts`) to exempt the store from eviction. **It deliberately skips Firefox**, which implements this as a user-facing permission prompt while Chromium and WebKit decide silently from engagement heuristics; prompting on page load is discouraged and a denial is sticky. Skipping Firefox is what makes a startup call safe everywhere else. Note that gating on the Permissions API instead would not work — Chrome reports `persistent-storage` as `"prompt"` yet never shows UI, so the state cannot distinguish "will prompt" from "decides silently".

Layout of a snippet:

```
/code/{nanoid(10)}/
  .snippet          # display name (hidden from the file tree)
  source/main.brs   # entry point
  manifest          # present only for SceneGraph projects
  components/ images/ ...
```

The 10-character id length is load-bearing: `populateCodeSelector` and `exportAllCode` enumerate `/code` and treat any entry of exactly length 10 as a snippet.

### Three storage generations

Snippets have been stored three different ways, and startup has to cope with all of them:

1. **v1.x** — raw code at a top-level 10-character `localStorage` key, optionally prefixed `@=Name=@`. Handled by `migrateOldSnippets()` in `src/snippets.ts`, which runs from `populateCodeSelector`.
2. **v2.0–2.1.7** — a ZenFS **1.11.4** filesystem over `localStorage`. ZenFS 2.x cannot read it *at all*: inodes went from 72 to 4096 bytes and 2.0.0 dropped the upgrade path, so `readdirSync("/code")` throws `EIO` against that data. Handled by `src/legacy-storage.ts`.
3. **current** — ZenFS 2.5.6 over IndexedDB.

`src/legacy-storage.ts` bridges 2 → 3 on startup, guarded by a `brsFiddle.fsVersion` marker. It **dynamically imports** `zenfs-legacy-core` (an npm alias for `@zenfs/core@1.11.4`) so webpack splits ZenFS 1.x into its own ~177 KB chunk that only migrating users download — keep that import dynamic. The old `localStorage` bytes are deliberately left in place as a backup; a future release can delete them. On failure it leaves the marker unset so a fixed build retries.

**The marker is only set when `isStoragePersistent()` is true.** If IndexedDB is blocked, the snippets are copied into the `InMemory` store so the session is usable, but setting the marker then would make a later session with working storage skip the migration and strand the data in `localStorage` forever. `migrateLegacyStorage()` returns `{ migrated, persisted }`; `main()` uses it to show `offerExportIfNotPersisted()` — a dialog explaining the limitation and offering `exportAllCode()` — because losing work deserves more than a toast.

Two things this depends on: `webpack.config.js` sets `resolve.modules` to `["node_modules", ...]` (relative, not absolute) so the nested `utilium@1.x` that the legacy copy needs is resolvable; and nothing may write snippet data back into `localStorage`, or `legacyDataPresent()` would misread live data as needing migration.

**Run mode is decided by `hasManifest(currentId)`**: with a manifest the whole snippet tree is zipped in memory with `fflate` and executed as a SceneGraph app; without one, the editor buffer is executed directly as a Draw2D `main.brs`.

Export/import uses a JSON envelope (`{ [id]: { name, files: { path: content } } }`) with images inlined as `data:image/…;base64` — not the same format as the zip used for execution.

## Testing — `test/`

Vitest on jsdom, covering `src/snippets.ts`, `src/util.ts`, `src/template-list.ts`, and `src/legacy-storage.ts`. Tests run against the **real** ZenFS stack (the IndexedDB backend over `fake-indexeddb`, the `Zip` backend, the actual files in `src/templates/`) — `fs` is never mocked, because storage is the thing under test. Only leaf side effects are stubbed: `toastify-js`, `file-saver`, and `URL.createObjectURL`.

`test/fixtures/zenfs-1.11.4-localstorage.json` is a verbatim capture of what ZenFS 1.11.4 wrote, produced by driving a real 1.11.4 install rather than written by hand. `test/storage-migration.test.ts` replays it to prove the bridge works against the format that actually shipped. Regenerate it only from a real 1.11.4 install.

Four constraints in `test/setup.ts` and `test/fs-helpers.ts` that are easy to break:

0. **`fake-indexeddb/auto` must be imported first** — jsdom has no IndexedDB at all.

1. **The DOM fixture must exist before `src/snippets.ts` is imported** — that module captures `#code-selector`, `#file-system`, `.folder-structure`, `#image-panel`, `#image-preview` at module scope. `setupFiles` runs before test-file evaluation, which is what makes this work. For the same reason `resetDom()` resets those nodes *in place*; assigning `document.body.innerHTML` would detach the handles the module is holding.
2. **Binary globals are realigned with Node's** (`globalThis.Uint8Array`, `globalThis.ArrayBuffer`). jsdom is a separate V8 realm, so those are not the constructors Node's `Buffer` and undici's `Response.arrayBuffer()` produce; `getSource()` in `@zenfs/archives` does `input instanceof ArrayBuffer` and rejects the fetched template zip. Both assignments are load-bearing — dropping either fails 15 template tests. Browsers have one realm, so this is test-only.
3. **`resetFs()` must close the IDB connection, then unmount, then delete the database** — `fs.mount()` throws `EINVAL` on an occupied mount point, and `deleteDatabase()` blocks forever while a connection is open. `remountFs()` deliberately does *not* delete the database; that is what makes it a real durability check.

`src/snippets.ts` keeps module-level state that leaks between tests in the same file: `currSelectedPath` (the save target, seeded by `loadCodeSnippet`/`highlightSelectedFile`) and `codeMap` (rebuilt by `populateCodeSelector`, read by `codeNameExists`). Set both explicitly rather than relying on test order.

Not covered: `src/index.ts` (share links, state, hotkeys, engine events) — its module scope builds a `WebTerminal` and calls `brs.getVersion()`, so it cannot be imported without a wider refactor. The editor modules need a live Monaco/CodeMirror instance.

## Conventions

- All source files carry the MIT copyright header block; keep it on new files.
- The `.snippet` name, not the directory name, is the user-visible snippet title; a leading `• ` in the selector marks unsaved changes and is stripped with `.replace(/^• /, "")` wherever the name is read back.
- User feedback goes through `showToast()` from `src/util.ts`; errors pass `true` as the third argument.
- CORS-restricted fetches from BrightScript go through a proxy (`corsProxy` in `main()`), disabled on `localhost`.

## Release & deploy

Pushing to `master` triggers `.github/workflows/build-github.yml`: `npm install && npm run release`, then publishes `app/` to GitHub Pages. The `GTAG` repo variable is injected into the HTML template for Google Analytics. `build-ftp.yml` does the same for the `old` branch via FTP.

Version bumps touch `package.json` **and** the version badge/link in `README.md` (the app displays `packageInfo.version` in the terminal banner).
