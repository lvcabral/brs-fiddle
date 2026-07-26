# BrightScript Fiddle - AI Coding Guide

## Project Overview
BrightScript Fiddle is a web-based code playground for the BrightScript language (Roku development). Built with TypeScript and Webpack, it provides an interactive editor with code execution, snippet management, and file system simulation. There is no backend — everything runs in the browser and persists to `localStorage`.

## Architecture

### Core Components
- **Main Entry** (`src/index.ts`): Central orchestrator managing UI, code execution, and integrations
- **Code Editors** (`src/editor/`): Two backends behind the `IEditorManager` interface (`src/editor/types.ts`) — Monaco on desktop (`monaco.ts`), CodeMirror 5 on iOS/Android (`codemirror.ts`)
- **Syntax Highlighting**: Implemented once per backend — `src/editor/brightscript-monaco.ts` (Monarch tokenizer + theme) and `src/editor/brightscript-codemirror.ts` (CodeMirror mode)
- **Snippet Management** (`src/snippets.ts`): ZenFS-based virtual file system for code storage and zip handling
- **BrightScript Engine**: External `brs-engine` library for code execution via web workers, with `brs-scenegraph` loaded as the SceneGraph extension
- **Virtual File System**: ZenFS 2.5.6 with the IndexedDB backend for persistent code storage
- **Legacy Bridge** (`src/legacy-storage.ts`): one-time migration from the pre-2.2 ZenFS-1.x-over-localStorage store

### Key Dependencies
- `brs-engine`: BrightScript simulation engine (external, loaded via webpack)
- `brs-scenegraph`: SceneGraph extension (`brs-sg.js`), registered through `brs.SupportedExtension.SceneGraph`
- `monaco-editor` / `codemirror`: editors with custom BrightScript language definitions
- `@zenfs/core`, `@zenfs/dom`, `@zenfs/archives`: Virtual file system for snippet storage and zip mounting
- `fflate`: In-memory zip creation for running SceneGraph projects
- `json-url/lzma`: URL-based code sharing with compression
- `@lvcabral/terminal`: Web-based terminal for BrightScript output

## Development Patterns

### File System Architecture
- **Code Storage**: Virtual file system at `/code/{10-char-id}/` with `.snippet` metadata files holding the display name
- **Snippet Layout**: `source/main.brs` is the entry point; a `manifest` file marks a SceneGraph project (alongside `components/`, `images/`, …)
- **Template System**: Pre-built BrightScript examples in `src/templates/` (both `.brs` and `.zip` formats), copied to `app/templates/` and fetched at runtime
- **Three storage generations**, all handled at startup:
  1. v1.x raw 10-char localStorage keys (optionally `@=Name=@`-prefixed) — `migrateOldSnippets()` in `src/snippets.ts`
  2. v2.0–2.1.7 ZenFS **1.11.4** over localStorage — unreadable by 2.x (inodes went 72 → 4096 bytes and the upgrade path was dropped, so `readdirSync("/code")` throws EIO). Bridged by `src/legacy-storage.ts`
  3. current: ZenFS 2.5.6 over IndexedDB (database `brsFiddle`)
- The `brsFiddle.fsVersion` marker is set **only** when storage is persistent. If IndexedDB is blocked the snippets are copied into `InMemory` so the session works, but marking it done would make a later working session skip the migration. `migrateLegacyStorage()` returns `{ migrated, persisted }` and `main()` shows a dialog offering an export when `persisted` is false
- The 10-character id length is load-bearing: `/code` enumeration treats any entry of exactly that length as a snippet
- Nothing may write snippet data back into localStorage, or `legacyDataPresent()` misreads live data as needing migration

### Build System
```bash
npm run build      # Development build
npm run release    # Production build (minified)
npm start          # Dev server with hot reload on :8500
npm test           # Vitest, single run (npx vitest run <file> for one file)
npm run test:watch # Vitest in watch mode
npm run test:coverage
npm run lint       # tslint (legacy config, still the linter of record)
npm run prettier   # Format check; prettier:write to fix
```
`app/` is build output and is gitignored; never edit it directly.

`npm run lint` has 6 **pre-existing** errors and two files are not Prettier-clean, both already true on `master` — CI runs tests and the build, not lint. Check against `master` before assuming a lint failure is yours.

### Code Editor Integration
- Language changes usually need mirroring in **both** `brightscript-monaco.ts` and `brightscript-codemirror.ts`
- `MonacoWebpackPlugin` only bundles the `xml` and `ini` built-in languages; BrightScript is registered at runtime. Adding a mode requires editing `webpack.config.js`
- Editor mode is chosen by file extension in `loadFile()`: `.brs` → `brightscript`, `.xml` → `xml`, extensionless (`manifest`) → `ini`
- Theme switching between "coda" (light) and "vscode-dark" for CodeMirror, and a generated BrightScript theme for Monaco
- Indentation type/size are user settings persisted in app state and pushed to the active editor

### Snippet Management Patterns
- **ID Generation**: 10-character nanoid for unique snippet identification
- **Naming Convention**: User-friendly names stored in `.snippet` files, separate from code content; a leading `• ` in the selector marks unsaved changes and is stripped with `.replace(/^• /, "")` wherever the name is read back
- **URL Sharing**: LZMA compression for shareable links via `json-url` codec; named snippets embed the name inline as `@=Name=@<code>`
- **Import/Export**: JSON envelope `{ [id]: { name, files: { path: content } } }` with images inlined as base64 data URIs — distinct from the zip used for execution

## Critical Workflows

### Code Execution Flow
Run mode is decided by `hasManifest(currentId)`:
1. **With a manifest** — the whole snippet tree is zipped in memory with `fflate` and executed as a SceneGraph app
2. **Without one** — the editor buffer is executed directly as a Draw2D `main.brs`

In both cases the code goes to `brs-engine` via web worker (`brs.worker.js`); the engine provides terminal output through `@lvcabral/terminal` and renders graphics/media on the display canvas. Engine events (`loaded`/`started`/`debug`/`closed`/`error`) arrive via `brs.subscribe` and drive the Run/Break/Resume/End buttons. Cross-Origin Isolation (COOP/COEP headers) is required for SharedArrayBuffer support.

### UI Changes
`src/index.ejs` is the HTML template and `src/index.ts` grabs every DOM handle at module scope. Adding a control means editing both files. New code templates must be added to `src/templates/` **and** the registry in `src/template-list.ts` — `test/template-list.test.ts` fails if the two drift apart.

### Testing
Vitest on jsdom in `test/`, covering `src/snippets.ts`, `src/util.ts`, `src/template-list.ts`, and `src/legacy-storage.ts`. Tests run against the real ZenFS stack (IndexedDB via `fake-indexeddb`) and the real template files rather than mocking `fs`; only `toastify-js`, `file-saver`, and `URL.createObjectURL` are stubbed. `test/setup.ts` and `test/fs-helpers.ts` document the environment constraints that are easy to break: `fake-indexeddb/auto` must be imported first, the DOM fixture must exist before `src/snippets.ts` is imported (it captures handles at module scope), the binary globals are realigned with Node's to survive jsdom's separate realm, and `resetFs()` must close the IDB connection before unmounting or `deleteDatabase()` blocks forever. `test/fixtures/zenfs-1.11.4-localstorage.json` is a verbatim capture from a real 1.11.4 install, replayed by `test/storage-migration.test.ts`. `src/index.ts` and the editor modules are not covered.

### Deployment Process
- **GitHub Pages**: Automatic deployment via `.github/workflows/build-github.yml` on master push (`npm install && npm run release`, publishes `app/`)
- **FTP**: `build-ftp.yml` does the same for the `old` branch
- **Assets Copying**: Webpack copies `brs-engine`/`brs-scenegraph` libs and assets, service worker, and static files to `app/`
- **Environment**: Google Analytics tracking via `GTAG` environment variable
- **Version bumps** touch `package.json` and the version badge/link in `README.md` (the terminal banner displays `packageInfo.version`)

## Project-Specific Conventions

### TypeScript Configuration
- Target: ES2022 with DOM and ESNext libs, `moduleResolution: "bundler"`
- Strict mode enabled with `noImplicitReturns` and `noFallthroughCasesInSwitch`
- Output to `app/lib/` directory for webpack integration

### Code Organization
- **External Dependencies**: `brs-engine` treated as an external webpack dependency
- **Utility Functions**: OS detection, file type checking, MIME types, and ID generation in `src/util.ts`
- **Copyright Header**: all source files carry the MIT header block; keep it on new files
- **Formatting**: Prettier with 4-space tabs, `printWidth: 100`, `trailingComma: "es5"` (configured inline in `package.json`)

### State Persistence
UI state lives under `localStorage["brsFiddle.state"]`: selected snippet id, audio/keyboard/gamepad switches, dark theme, file-tree visibility, and indentation settings.

### Error Handling
- Toast notifications via `showToast()` in `src/util.ts` — pass `true` as the third argument for errors
- LocalStorage usage monitoring and migration for legacy compatibility
- File system error handling with fallback mechanisms

## Integration Points

### BrightScript Engine Communication
```typescript
// Engine loaded externally, accessed via global 'brs' object
import * as brs from "brs-engine";
// Web worker execution pattern for non-blocking code execution
```

### Cross-Origin Requirements
Dev server and production require COOP/COEP headers for `SharedArrayBuffer` support:
```javascript
headers: {
    "cross-origin-embedder-policy": "require-corp",
    "cross-origin-opener-policy": "same-origin"
}
```
GitHub Pages cannot set these, so `coi-serviceworker` installs a service worker that adds them. Anything that breaks isolation breaks execution entirely.

### CORS Proxy
Network calls from BrightScript go through the proxy configured as `corsProxy` in `main()`; it is disabled when running on `localhost`.

### File System Abstraction
ZenFS provides Node.js-like filesystem APIs in browser. `/code` is mounted on **IndexedDB**; `src/snippets.ts` stays fully synchronous because `IndexedDB.create()` preloads the store into memory before resolving — so nothing may call `fs.*Sync` before `await initializeFileSystem()`. If IndexedDB is unavailable it falls back to `InMemory` with a warning toast (`isStoragePersistent()` reports which). After mounting it calls `requestPersistentStorage()` to avoid eviction, which **skips Firefox** — Firefox shows a permission prompt for this while Chromium/WebKit decide silently, and prompting on page load is discouraged.
```typescript
fs.readdirSync("/code")           // List code snippets
fs.writeFileSync(path, content)   // Save files
await fs.configure({ mounts: ... }) // Setup virtual mounts
```
Template zips are temporarily mounted at `/mnt/zip` with the `Zip` backend and copied out into `/code/{id}/`.

The legacy bridge imports `zenfs-legacy-core` (npm alias for `@zenfs/core@1.11.4`) **dynamically**, so webpack splits ZenFS 1.x into its own ~177 KB chunk that only migrating users download. Keep that import dynamic, and keep `resolve.modules` in `webpack.config.js` relative (`"node_modules"`, not an absolute path) so the nested `utilium@1.x` it needs resolves.

This architecture enables a full BrightScript development environment in the browser while maintaining compatibility with Roku's ecosystem and providing seamless code sharing capabilities.
