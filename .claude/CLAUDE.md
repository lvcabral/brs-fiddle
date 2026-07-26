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
npm run lint         # tslint (legacy config, still the linter of record)
npm run prettier     # check formatting; `npm run prettier:write` to fix
npm run clean        # rimraf ./types ./app
```

There is no test suite and no test runner configured. Verification is manual: `npm start`, then run a snippet in the browser.

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
- **Templates** are declared in the `templates` array at the top of the file, with files under `src/templates/` (copied to `app/templates/` and fetched at runtime). `.brs` templates load as a single source file; `.zip` templates are full SceneGraph projects. A new template must be added to both places.
- **Layout** is manually managed: `resizeCanvas` keeps the display canvas 16:9, the drag separator resizes the code column, and `editorManager.layout()` must be called after any size change.

### Editors — `src/editor/`

Two editor backends behind the `IEditorManager` interface (`editor/types.ts`), chosen by platform in `initializeCodeEditor()`:

- **Monaco** (`monaco.ts`) on desktop — replaces the `#brsCode` textarea with a generated `#monacoEditor` div.
- **CodeMirror 5** (`codemirror.ts`) on iOS/Android — attaches to the textarea directly.

BrightScript syntax support is implemented **twice**, once per backend: `brightscript-monaco.ts` (Monarch tokenizer + theme, derived from the RokuCommunity VS Code extension grammar) and `brightscript-codemirror.ts` (CodeMirror mode). Language changes generally need to be mirrored in both. `MonacoWebpackPlugin` only ships the `xml` and `ini` built-in languages — BrightScript is registered at runtime — so adding a language mode requires updating `webpack.config.js`.

Editor modes map from file extension in `loadFile()`: `.brs` → `brightscript`, `.xml` → `xml`, extensionless (i.e. `manifest`) → `ini`.

### Storage — `src/snippets.ts`

ZenFS provides a Node-like `fs` API in the browser. `/code` is mounted on the `WebStorage` backend over `localStorage`; template zips are temporarily mounted at `/mnt/zip` via the `Zip` backend and copied out.

Layout of a snippet:

```
/code/{nanoid(10)}/
  .snippet          # display name (hidden from the file tree)
  source/main.brs   # entry point
  manifest          # present only for SceneGraph projects
  components/ images/ ...
```

The 10-character id length is load-bearing: `populateCodeSelector` and `exportAllCode` enumerate `/code` and treat any entry of exactly length 10 as a snippet. `migrateOldSnippets` converts the v1.x format (raw code stored at a top-level 10-char localStorage key, optionally prefixed `@=Name=@`) into this structure and deletes the old key.

**Run mode is decided by `hasManifest(currentId)`**: with a manifest the whole snippet tree is zipped in memory with `fflate` and executed as a SceneGraph app; without one, the editor buffer is executed directly as a Draw2D `main.brs`.

Export/import uses a JSON envelope (`{ [id]: { name, files: { path: content } } }`) with images inlined as `data:image/…;base64` — not the same format as the zip used for execution.

## Conventions

- All source files carry the MIT copyright header block; keep it on new files.
- The `.snippet` name, not the directory name, is the user-visible snippet title; a leading `• ` in the selector marks unsaved changes and is stripped with `.replace(/^• /, "")` wherever the name is read back.
- User feedback goes through `showToast()` from `src/util.ts`; errors pass `true` as the third argument.
- CORS-restricted fetches from BrightScript go through a proxy (`corsProxy` in `main()`), disabled on `localhost`.

## Release & deploy

Pushing to `master` triggers `.github/workflows/build-github.yml`: `npm install && npm run release`, then publishes `app/` to GitHub Pages. The `GTAG` repo variable is injected into the HTML template for Google Analytics. `build-ftp.yml` does the same for the `old` branch via FTP.

Version bumps touch `package.json` **and** the version badge/link in `README.md` (the app displays `packageInfo.version` in the terminal banner).
