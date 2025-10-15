# BrightScript Fiddle - AI Coding Guide

## Project Overview
BrightScript Fiddle is a web-based code playground for the BrightScript language (Roku development). Built with TypeScript and Webpack, it provides an interactive editor with code execution, snippet management, and file system simulation.

## Architecture

### Core Components
- **Main Entry** (`src/index.ts`): Central orchestrator managing UI, code execution, and integrations
- **Code Editor** (`src/codemirror.ts`): CodeMirror integration with custom BrightScript syntax highlighting
- **Snippet Management** (`src/snippets.ts`): ZenFS-based virtual file system for code storage and zip handling
- **BrightScript Engine**: External `brs-engine` library for code execution via web workers
- **Virtual File System**: ZenFS with localStorage backend for persistent code storage

### Key Dependencies
- `brs-engine`: BrightScript simulation engine (external, loaded via webpack)
- `codemirror`: Code editor with custom BrightScript mode (`src/brightscript.ts`)
- `@zenfs/core`: Virtual file system for snippet storage
- `json-url/lzma`: URL-based code sharing with compression
- `@lvcabral/terminal`: Web-based terminal for BrightScript output

## Development Patterns

### File System Architecture
- **Code Storage**: Virtual file system at `/code/{10-char-id}/` with `.snippet` metadata files
- **Template System**: Pre-built BrightScript examples in `src/templates/` (both `.brs` and `.zip` formats)
- **Migration Logic**: Automatic conversion from v1.x localStorage format to ZenFS structure

### Build System
```bash
yarn build      # Development build
yarn release    # Production build (minified)
yarn start      # Dev server with hot reload on :8500
```

### Code Editor Integration
- Custom BrightScript syntax highlighting in `src/brightscript.ts`
- Theme switching between "coda" (light) and "vscode-dark" themes
- Auto-completion and bracket matching enabled by default

### Snippet Management Patterns
- **ID Generation**: 10-character nanoid for unique snippet identification  
- **Naming Convention**: User-friendly names stored in `.snippet` files, separate from code content
- **URL Sharing**: LZMA compression for shareable links via `json-url` codec
- **Import/Export**: Full zip file support for multi-file BrightScript projects

## Critical Workflows

### Code Execution Flow
1. Code submitted to `brs-engine` via web worker (`brs.worker.js`)
2. Engine provides terminal output through `@lvcabral/terminal`
3. Graphics/media rendered via engine's built-in screen simulation
4. Cross-Origin Isolation required (COOP/COEP headers) for SharedArrayBuffer support

### Deployment Process
- **GitHub Pages**: Automatic deployment via `.github/workflows/build-github.yml` on master push
- **Assets Copying**: Webpack copies `brs-engine` assets, service workers, and static files to `app/`
- **Environment**: Google Analytics tracking via `GTAG` environment variable

## Project-Specific Conventions

### TypeScript Configuration
- Target: ES2022 with DOM and ESNext libs
- Strict mode enabled with `noImplicitReturns` and `noFallthroughCasesInSwitch`
- Output to `app/lib/` directory for webpack integration

### Code Organization
- **External Dependencies**: `brs-engine` treated as external webpack dependency
- **Utility Functions**: OS detection, file type checking, and ID generation in `src/util.ts`
- **Theme Management**: Consistent light/dark theme switching across CodeMirror and UI

### Error Handling
- Toast notifications via `toastify-js` for user feedback
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

### File System Abstraction
ZenFS provides Node.js-like filesystem APIs in browser:
```typescript
fs.readdirSync("/code")           // List code snippets
fs.writeFileSync(path, content)   // Save files
await fs.configure({ mounts: ... }) // Setup virtual mounts
```

This architecture enables a full BrightScript development environment in the browser while maintaining compatibility with Roku's ecosystem and providing seamless code sharing capabilities.