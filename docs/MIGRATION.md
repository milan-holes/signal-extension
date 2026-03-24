# Signal Extension — Vue 3 + TypeScript Migration Guide

## Table of Contents

- [Current State](#current-state)
- [Architecture Overview](#architecture-overview)
- [Build System](#build-system)
- [Migration Order](#migration-order)
- [Phase 1: Content Script (Widget)](#phase-1-content-script-widget)
- [Phase 2: Screenshot Editor](#phase-2-screenshot-editor)
- [Phase 3: Background Service Worker](#phase-3-background-service-worker)
- [Phase 4: Viewer](#phase-4-viewer)
- [Conversion Patterns](#conversion-patterns)
- [Shared Composables](#shared-composables)
- [Type Definitions](#type-definitions)
- [Testing Checklist](#testing-checklist)
- [Known Issues](#known-issues)

---

## Current State

| Component | Original | Lines | Vue Status | Notes |
|-----------|----------|-------|------------|-------|
| **Popup** | `popup.html` + `popup.js` | 425+330 | ✅ Done → `Popup.vue` | Full 1:1 port of HTML, CSS, JS |
| **Content Script** | `content.js` | 2980 | ⚠️ Partial → `Widget.vue` is placeholder | Widget.vue (83 lines) is a skeleton; original content.js is used via IIFE build |
| **Screenshot Editor** | `screenshot-editor.html` + `screenshot-editor.js` | 241+265 | ❌ Originals in `public/` | Smallest page, best next target |
| **Background** | `background.js` | 1781 | ❌ Original in `public/` | Service worker (TS only, never Vue) |
| **Viewer** | `viewer.html` + `viewer.js` | 1816+4015 | ❌ Originals in `public/` | Largest component, needs incremental approach |

### What's Already Set Up

```
src/
├── background/index.ts          # Skeleton — NOT used (original in public/)
├── content/
│   ├── index.ts                 # Shadow DOM bootstrap (used, builds as IIFE)
│   └── components/Widget.vue    # Placeholder — NOT the full widget
├── popup/
│   ├── index.html               # Entry point
│   ├── main.ts                  # Vue mount
│   └── Popup.vue                # ✅ COMPLETE — 1:1 port
├── screenshot-editor/
│   ├── index.html               # Entry point (exists but points to placeholder)
│   ├── main.ts                  # Vue mount
│   └── Editor.vue               # Placeholder
├── shared/styles/global.css     # CSS variables (not actively used)
├── viewer/
│   ├── index.html               # Entry point (exists but points to placeholder)
│   ├── main.ts                  # Vue mount
│   └── Viewer.vue               # Placeholder
└── env.d.ts                     # TypeScript shims
```

### Files in `public/` (Copied to `dist/` as-is)

```
public/
├── manifest.json                # Extension manifest
├── background.js                # Full original background service worker
├── viewer.html                  # Full original viewer page
├── viewer.js                    # Full original viewer logic (4015 lines)
├── screenshot-editor.html       # Full original editor page
├── screenshot-editor.js         # Full original editor logic
├── jszip.min.js                 # ZIP library (used by viewer export)
├── jira-helper.js               # JIRA integration helper
└── icons/                       # Extension icons
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Chrome Extension                           │
│                                                               │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Popup.vue   │  │   Viewer Page    │  │  Editor Page  │  │
│  │  (ext popup)  │  │ (new tab, full)  │  │ (new tab)     │  │
│  │               │  │                  │  │               │  │
│  │ Start/Stop    │  │ Timeline         │  │ Canvas tools  │  │
│  │ Screenshot    │  │ Console          │  │ Highlight     │  │
│  │ Settings      │  │ Network          │  │ Blur          │  │
│  │               │  │ Storage          │  │ Download      │  │
│  │               │  │ Replay config    │  │ JIRA upload   │  │
│  │               │  │ Screencast       │  │               │  │
│  │               │  │ Share/Export      │  │               │  │
│  └───────┬───────┘  └────────┬─────────┘  └──────┬────────┘  │
│          │                   │                    │           │
│          └───────────────────┼────────────────────┘           │
│                              │                                │
│                   chrome.runtime.sendMessage                  │
│                              │                                │
│                   ┌──────────▼──────────┐                     │
│                   │  background.js      │                     │
│                   │  (service worker)   │                     │
│                   │                     │                     │
│                   │  - Recording state  │                     │
│                   │  - Debugger attach  │                     │
│                   │  - Screencast       │                     │
│                   │  - Network capture  │                     │
│                   │  - Console capture  │                     │
│                   │  - Replay engine    │                     │
│                   │  - Report generator │                     │
│                   │  - Screenshot       │                     │
│                   └──────────┬──────────┘                     │
│                              │                                │
│                   chrome.tabs.sendMessage                     │
│                              │                                │
│                   ┌──────────▼──────────┐                     │
│                   │   content.js        │                     │
│                   │  (injected IIFE)    │                     │
│                   │                     │                     │
│                   │  - Floating widget  │                     │
│                   │  - Click tracking   │                     │
│                   │  - Input tracking   │                     │
│                   │  - Replay widget    │                     │
│                   │  - Screenshot UI    │                     │
│                   │  - Issue reporting  │                     │
│                   └─────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### Communication Flow

| From → To | Method | Example |
|-----------|--------|---------|
| Popup → Background | `chrome.runtime.sendMessage` | `{ action: "start" }` |
| Background → Content | `chrome.tabs.sendMessage` | `{ action: "showOverlay" }` |
| Content → Background | `chrome.runtime.sendMessage` | `{ action: "recordUserEvent" }` |
| Viewer → Background | `chrome.runtime.sendMessage` | `{ action: "replayEvents" }` |
| Any → Storage | `chrome.storage.local.get/set` | Settings, theme, report data |

### Message Actions Reference

**Background handles these actions (28 total):**

| Action | From | Purpose |
|--------|------|---------|
| `start` | Popup/Widget | Start recording |
| `stop` | Popup/Widget | Stop recording |
| `pause` | Widget | Pause recording |
| `resume` | Widget | Resume recording |
| `togglePause` | Popup | Toggle pause state |
| `checkStatus` | Popup | Get recording state |
| `getReport` | Popup | Get report data |
| `saveReport` | Widget | Save report to storage |
| `openViewer` | Widget/Popup | Open viewer in new tab |
| `openScreenshotEditor` | Widget | Open screenshot editor |
| `initiateScreenshot` | Popup | Trigger screenshot flow |
| `captureScreenshot` | Content | Capture screen via debugger |
| `recordUserEvent` | Content | Record click/input/navigation |
| `recordIssue` | Content | Record user-reported issue |
| `recordContentChange` | Content | Record DOM edit |
| `downloadContentChanges` | Popup | Export content changes |
| `replayEvents` | Viewer | Start replay session |
| `replayStart` | Content (replay widget) | Begin replaying events |
| `replayPause` | Content | Pause replay |
| `replayResume` | Content | Resume replay |
| `replayRetry` | Content | Retry failed event |
| `replaySkip` | Content | Skip current event |
| `replayCancel` | Content | Cancel replay |
| `replayRestart` | Content | Restart entire replay |
| `replayRemoveEvent` | Content | Remove event from queue |
| `replaySetDelay` | Content | Change replay speed |
| `replaySkipFailed` | Content | Skip failed event |
| `replayClose` | Content | Close replay session |

---

## Build System

### Two Vite Configs

**`vite.config.ts`** — Main build (HTML pages)
```typescript
// Builds: popup (Vue SFC → HTML + JS + CSS)
// Later: viewer, screenshot-editor
rollupOptions: {
  input: {
    popup: resolve(__dirname, 'src/popup/index.html'),
    // Add these as you port them:
    // viewer: resolve(__dirname, 'src/viewer/index.html'),
    // editor: resolve(__dirname, 'src/screenshot-editor/index.html'),
  }
}
```

**`vite.config.content.ts`** — Content script build (IIFE)
```typescript
// Builds: content.js as self-contained IIFE bundle
// IMPORTANT: emptyOutDir: false (don't wipe main build)
build: {
  lib: {
    entry: resolve(__dirname, 'src/content/index.ts'),
    formats: ['iife'],
    name: 'SignalContent',
    fileName: () => 'content.js'
  }
}
```

### Build Commands

```bash
npm run build          # Full build (main + content)
npm run build:fast     # Main build only (no content script)
npm run dev            # Watch mode (rebuilds on changes)
```

### How Files Get to `dist/`

| File | Source | How It Gets There |
|------|--------|-------------------|
| `src/popup/index.html` | Vite HTML build | → `dist/src/popup/index.html` |
| `assets/popup-*.js/.css` | Vite bundle | → `dist/assets/` |
| `content.js` | IIFE lib build | → `dist/content.js` |
| `background.js` | `public/background.js` | → Copied by Vite `publicDir` |
| `viewer.html` | `public/viewer.html` | → Copied by Vite `publicDir` |
| `viewer.js` | `public/viewer.js` | → Copied by Vite `publicDir` |
| `manifest.json` | `public/manifest.json` | → Copied by Vite `publicDir` |
| Icons | `public/icons/` | → Copied by Vite `publicDir` |

### When You Port a Component

1. Create/update the Vue SFC in `src/`
2. Add its HTML entry to `vite.config.ts` `rollupOptions.input`
3. Remove the original file from `public/`
4. Update `manifest.json` paths if needed
5. Build & test

---

## Migration Order

```
1. Content Script (Widget)  ──→  Highest complexity, but IIFE build is already set up
2. Screenshot Editor         ──→  Smallest page, self-contained canvas logic
3. Background (→ TypeScript) ──→  Pure TS, no Vue (service worker)
4. Viewer (incremental)      ──→  Largest, break into sub-components
```

---

## Phase 1: Content Script (Widget)

### Current State
- `src/content/index.ts` bootstraps the Vue widget in a Shadow DOM
- `src/content/components/Widget.vue` is an 83-line placeholder
- The actual content script logic is in `content.js` (2980 lines)
- Built as IIFE via `vite.config.content.ts`

### Why It's Complex
The content script is **not just a widget** — it's a full system:
- Floating widget with multiple states (idle, recording, paused)
- Drag-and-drop positioning
- Screenshot selection overlay
- Issue reporting with highlight box
- Replay widget (receives events from background, shows progress)
- User event tracking (clicks, inputs, navigation)
- Content editing mode
- Theme support

### Migration Strategy
Since the content script must be an IIFE (no module imports in injected scripts), and it uses a Shadow DOM already, the Vue approach works well. The widget UI becomes Vue components, but the event tracking and message handling stay as plain TypeScript.

### Sub-components to Create

| Component | Responsibility | Original Functions |
|-----------|---------------|-------------------|
| `Widget.vue` | Container with state management | `setWidgetIdle()`, `setWidgetRecording()`, `updateWidgetVisibility()` |
| `IdleControls.vue` | Start + Screenshot buttons | Part of `setWidgetIdle()` |
| `RecordingControls.vue` | Stop + Report + Cancel | `setWidgetRecording()`, `stopRecording()`, `cancelRecording()` |
| `ReplayWidget.vue` | Replay progress/controls | Lines 870-1100 of content.js (replay widget logic) |
| `ScreenshotMenu.vue` | Screenshot type dropdown | `toggleScreenshotMenu()` |
| `SelectionOverlay.vue` | Region selection for screenshots/issues | `startSelectionOverlay()` |

### Key Original Functions (content.js)

| Function | Lines | Purpose |
|----------|-------|---------|
| `createWidgetBtn()` | 100-112 | Creates styled button elements |
| `signalToast()` | 114-133 | Shows toast notifications |
| `createDragHandle()` | 135-142 | Creates drag grip for widget |
| `toggleScreenshotMenu()` | 146-202 | Screenshot type dropdown |
| `setWidgetIdle()` | 204-339 | Widget UI when not recording |
| `setWidgetRecording()` | 341-411 | Widget UI during recording |
| `updateWidgetVisibility()` | 415-428 | Show/hide based on settings |
| `togglePause()` | 484-488 | Pause/resume recording |
| `stopRecording()` | 490-502 | Stop recording and save |
| `cancelRecording()` | 504-521 | Discard recording |
| `performScreenshot()` | 611-619 | Initiate screenshot capture |
| `promptAndCapture()` | 621-675 | Capture with type/area |
| `startSelectionOverlay()` | 692-779 | Region selection UI |
| `highlightAndReport()` | 786-870 | Issue reporting flow |
| Message handler | 1050-1200 | `chrome.runtime.onMessage` handler |
| Replay widget logic | 1200-1600 | Replay UI and controls |
| User event tracking | 1600-2000 | Click/input/navigation recording |
| Click visualizer | 2000-2100 | Show click ripples |
| PII masking | 2100-2200 | Mask sensitive inputs |

### Steps

1. **Create composable:** `src/content/composables/useContentState.ts`
   - Reactive state: `isRecording`, `isPaused`, `currentMode`, `showWidget`, `isEditMode`
   - Settings management
   - Chrome message handler

2. **Port Widget.vue:** Copy the exact widget structure from `setWidgetIdle()` and `setWidgetRecording()`
   - Use `v-if` to switch between idle/recording/replay states
   - Port all CSS inline styles to scoped CSS
   - Keep the Shadow DOM bootstrap in `index.ts`

3. **Port event tracking:** Create `src/content/tracking.ts`
   - Click tracking with viewport coordinates
   - Input tracking with PII masking
   - Navigation tracking
   - This stays as plain TS (no Vue needed)

4. **Port replay widget:** Create `ReplayWidget.vue`
   - Progress display, pause/resume/skip/cancel buttons
   - Event list with status indicators

5. **Build & test:** The IIFE build should produce a single `content.js` with everything bundled

### Critical: IIFE Build Compatibility
The content script is built as IIFE — all Vue code gets bundled into a single file. This works because:
- Vite tree-shakes Vue (only includes what's used)
- The Shadow DOM isolates styles
- No dynamic imports needed

---

## Phase 2: Screenshot Editor

### Current State
- `screenshot-editor.html` (241 lines) — HTML + CSS
- `screenshot-editor.js` (265 lines) — Canvas logic
- Both in `public/`, served as-is

### What the Editor Does
1. Loads screenshot from `chrome.storage.local` (key: `tempScreenshot`)
2. Displays on canvas with drawing tools (highlight, blur, draw)
3. If `highlightBox` exists (from element selection), auto-draws a red border
4. Tool palette: Highlight (yellow), Blur (pixelate), Black draw, Reset
5. Actions: Download PNG, send to JIRA

### Key Original Functions (screenshot-editor.js)

| Function | Lines | Purpose |
|----------|-------|---------|
| `DOMContentLoaded` handler | 7-65 | Load theme, screenshot, init canvas, tool buttons |
| `setActiveTool()` | 67-78 | Toggle active tool class |
| `initCanvas()` | 80-156 | Create canvas, draw handlers (mouse events) |
| `getPos()` | 158-166 | Mouse position calculation |
| `draw()` | 168-188 | Draw stroke on canvas (highlight/blur/black) |
| `generateFinalCanvas()` | 190-247 | Merge drawing + background into final image |
| `downloadFinal()` | 249-265 | Download as PNG with metadata text |

### Migration Steps

1. **Create `src/screenshot-editor/Editor.vue`:**

   ```vue
   <template>
     <div class="editor-container">
       <h2>
         Screenshot Editor
         <span class="timestamp" id="timestamp"></span>
       </h2>

       <!-- Toolbar -->
       <div class="toolbar">
         <button @click="setTool('highlight')" :class="{ active: currentTool === 'highlight' }">
           🟨 Highlight
         </button>
         <button @click="setTool('blur')" :class="{ active: currentTool === 'blur' }">
           ⬜ Blur
         </button>
         <button @click="setTool('draw')" :class="{ active: currentTool === 'draw' }">
           ⬛ Draw
         </button>
         <button @click="resetCanvas">↩ Reset</button>
       </div>

       <!-- Canvas -->
       <div class="preview-container">
         <canvas ref="canvasRef"></canvas>
       </div>

       <!-- Actions -->
       <div class="actions">
         <button @click="downloadFinal" class="primary">⬇ Download</button>
         <button v-if="jiraAvailable" @click="sendToJira" class="jira">📎 Send to JIRA</button>
       </div>
     </div>
   </template>
   ```

2. **Port CSS:** Copy the entire `<style>` block from `screenshot-editor.html` lines 6-162 into `<style>` in Editor.vue

3. **Port JS logic to `<script setup>`:**
   - Canvas ref: `const canvasRef = ref<HTMLCanvasElement | null>(null)`
   - Drawing state: `currentTool`, `isDrawing`, `lastX`, `lastY`
   - `onMounted`: Load screenshot from `chrome.storage.local`, init canvas
   - Canvas event handlers: `@mousedown`, `@mousemove`, `@mouseup`
   - Tool functions: `setTool()`, `resetCanvas()`
   - Export functions: `downloadFinal()`, `generateFinalCanvas()`

4. **Update Vite config:**
   ```typescript
   input: {
     popup: resolve(__dirname, 'src/popup/index.html'),
     editor: resolve(__dirname, 'src/screenshot-editor/index.html'),
   }
   ```

5. **Remove from `public/`:** Delete `public/screenshot-editor.html` and `public/screenshot-editor.js`

6. **Update `manifest.json`:** If `web_accessible_resources` references `screenshot-editor.html`, update path

---

## Phase 3: Background Service Worker

### Critical Rule
> **The background script is a Chrome service worker. It has NO DOM.
> Port to TypeScript only. NEVER import Vue in this file.**

### Current State
`background.js` (1781 lines) handles ALL extension logic.

### Major Sections

| Section | Lines | Key Functions |
|---------|-------|---------------|
| **Settings** | 1-25 | Load/watch `chrome.storage.local` settings |
| **Auto-record** | 26-68 | `chrome.tabs.onUpdated` listener for buffer mode |
| **Recording** | 70-200 | `startRecording()` — debugger attach, enable domains |
| **Buffer pruning** | 202-237 | `pruneData()` — trim old data from buffer |
| **Message handler** | 239-786 | `chrome.runtime.onMessage` — 28 actions |
| **Report generation** | 788-915 | `generateReport()` — format raw data, redact PII |
| **Debugger events** | 917-1062 | `chrome.debugger.onEvent` — console, network, screencast |
| **Replay helpers** | 1063-1138 | `waitForContentScript()`, widget communication helpers |
| **Replay engine** | 1141-1381 | `executeReplay()` — step through events |
| **Replay retry** | 1383-1435 | `replayRetryEvent()` |
| **Environment setup** | 1437-1536 | `setupReplayEnvironment()` — inject storage/cookies |
| **CDP helpers** | 1538-1569 | `sendCommand()`, `sleep()` |
| **Click execution** | 1571-1693 | `executeClick()` — find element, dispatch events |
| **Input execution** | 1695-1781 | `executeInput()` — find input, set value |

### Migration Steps

1. **Create type definitions first:** `src/shared/types/`
   ```typescript
   // src/shared/types/recording.ts
   interface RecordingState {
     mode: 'standard' | 'buffer' | 'manual_edit';
     isRecording: boolean;
     isPaused: boolean;
     logs: ConsoleEntry[];
     network: Record<string, NetworkEntry>;
     userEvents: UserEvent[];
     screencast: ScreencastFrame[];
     issues: Issue[];
     contentChanges: ContentChange[];
     startTime: string;
     environment?: EnvironmentData;
     storage?: StorageData;
   }

   // src/shared/types/messages.ts
   type MessageAction =
     | 'start' | 'stop' | 'pause' | 'resume' | 'togglePause'
     | 'checkStatus' | 'getReport' | 'saveReport'
     | 'openViewer' | 'openScreenshotEditor'
     | 'initiateScreenshot' | 'captureScreenshot'
     | 'recordUserEvent' | 'recordIssue' | 'recordContentChange'
     | 'downloadContentChanges'
     | 'replayEvents' | 'replayStart' | 'replayPause' | 'replayResume'
     | 'replayRetry' | 'replaySkip' | 'replayCancel' | 'replayRestart'
     | 'replayRemoveEvent' | 'replaySetDelay' | 'replaySkipFailed' | 'replayClose';
   ```

2. **Port section by section to `src/background/index.ts`:**
   - Start with types and state variables
   - Port `startRecording()` (most critical)
   - Port the message handler (action by action)
   - Port `generateReport()` (standalone function)
   - Port the debugger event listener
   - PORT replay functions last (most complex)

3. **Add to Vite config:**
   ```typescript
   input: {
     popup: resolve(__dirname, 'src/popup/index.html'),
     background: resolve(__dirname, 'src/background/index.ts'),
   },
   output: {
     entryFileNames: (chunkInfo) => {
       if (chunkInfo.name === 'background') return 'background.js';
       return 'assets/[name]-[hash].js';
     },
   }
   ```

4. **Manifest update:**
   ```json
   "background": {
     "service_worker": "background.js",
     "type": "module"
   }
   ```
   Note: When built by Vite with ES modules, `"type": "module"` is required.

5. **Remove from `public/`:** Delete `public/background.js`

---

## Phase 4: Viewer

### Current State
The viewer is the largest component:
- `viewer.html` — 1816 lines of HTML (sidebar, tabs, modals, tables, player)
- `viewer.js` — 4015 lines of JS (rendering, filtering, sorting, replay config, screencast, export, webhook, script generation)

### Strategy: Incremental Decomposition

Port one tab/section at a time while keeping the rest working.

### Sub-components

```
src/viewer/
├── Viewer.vue                    # Shell: sidebar + header + tab container
├── components/
│   ├── HeaderBar.vue             # Top bar: import, replay, share dropdown, editor mode
│   ├── SidebarNav.vue            # Tab navigation items
│   ├── EmptyState.vue            # "Drop or import" initial state
│   │
│   ├── tabs/
│   │   ├── DashboardTab.vue      # Timeline table + screencast + tab panels
│   │   ├── ConsoleTab.vue        # Console log table with filters
│   │   ├── NetworkTab.vue        # Network table with filters + detail panel
│   │   ├── StorageTab.vue        # Storage viewer (local/session/cookies)
│   │   ├── EnvironmentTab.vue    # Environment info cards
│   │   ├── IssuesTab.vue         # Issues list
│   │   └── ChangesTab.vue        # Content changes list
│   │
│   ├── player/
│   │   ├── ScreencastPlayer.vue  # Video player + scrubber + controls
│   │   └── FullscreenPlayer.vue  # Fullscreen player overlay
│   │
│   ├── timeline/
│   │   ├── TimelineTable.vue     # Event list (user events + issues)
│   │   ├── TimelineConsole.vue   # Console sub-panel within timeline
│   │   ├── TimelineNetwork.vue   # Network sub-panel within timeline
│   │   └── TimelineDetails.vue   # Event details panel
│   │
│   ├── modals/
│   │   ├── ReplayConfigModal.vue # Replay setup (URL, storage, requests)
│   │   ├── WebhookModal.vue      # Webhook sender
│   │   ├── ScriptModal.vue       # Generated Playwright/Puppeteer scripts
│   │   └── RequestComposer.vue   # HTTP request composer
│   │
│   └── shared/
│       ├── DetailPanel.vue       # Resizable side panel
│       ├── FilterBar.vue         # Filter chips + search input
│       ├── SortableTable.vue     # Reusable sortable table
│       └── CopyButton.vue        # Copy-to-clipboard button
│
└── composables/
    ├── useReportData.ts          # Shared report data store
    ├── useScreencast.ts          # Screencast playback state
    ├── useFilter.ts              # Reusable filter/sort logic
    └── useToast.ts               # Toast notification system
```

### Key Original Functions (viewer.js) — Where They Map

| Function | Lines | Target Component |
|----------|-------|-----------------|
| `showToast()` | 1-42 | `useToast.ts` composable |
| `applyTheme()` | 60-62 | `useTheme.ts` composable |
| `addStorageRow()` | 205-258 | `ReplayConfigModal.vue` |
| `addRequestRow()` | 280-363 | `ReplayConfigModal.vue` |
| `gatherStorage()` | 376-386 | `ReplayConfigModal.vue` |
| `closeShareDropdown()` | 476-478 | `HeaderBar.vue` |
| `exportRecording()` | 506-600 | `HeaderBar.vue` or composable |
| `generateLLMContext()` | 626-732 | `HeaderBar.vue` or composable |
| `generateScript()` | 754-857 | `ScriptModal.vue` |
| `resetButtons()` | 1076-1086 | `HeaderBar.vue` |
| `showEmptyState()` | 1559-1562 | `EmptyState.vue` |
| `hideEmptyState()` | 1564-1567 | `EmptyState.vue` |
| `renderReport()` | 1569-1696 | `Viewer.vue` (orchestrator) |
| `renderContentChanges()` | 1698-1758 | `ChangesTab.vue` |
| `filterAndRenderNetwork()` | 1760-1816 | `NetworkTab.vue` |
| `filterAndRenderConsole()` | 1818-1863 | `ConsoleTab.vue` |
| `renderConsole()` | 1866-1936 | `ConsoleTab.vue` |
| `renderNetwork()` | 1967-2067 | `NetworkTab.vue` |
| `renderTimeline()` | 2069-2441 | `DashboardTab.vue` + sub-components |
| `updatePreview()` | 2443-2491 | `ScreencastPlayer.vue` |
| `updateTabsContent()` | 2503-2641 | Timeline sub-panels |
| `highlightEventRow()` | 2643-2697 | `TimelineTable.vue` |
| `createCopyBtnHTML()` | 2699-2704 | `CopyButton.vue` |
| `showDetails()` | 2739-2944 | `DetailPanel.vue` (network) |
| `viewSource()` | 2946-2988 | Utility function |
| `showConsoleDetails()` | 2990-3075 | `DetailPanel.vue` (console) |
| `renderScreencast()` | 3077-3475 | `ScreencastPlayer.vue` |
| `renderIssues()` | 3477-3562 | `IssuesTab.vue` |
| `escapeHtml()` | 3564-3572 | `src/shared/utils/escapeHtml.ts` |
| `renderEnvironment()` | 3574-3783 | `EnvironmentTab.vue` |
| `renderStorage()` | 3784-3925 | `StorageTab.vue` |
| `openRequestComposer()` | 3927-3975 | `RequestComposer.vue` |
| `generateFetch()` | 3977-3997 | `RequestComposer.vue` |
| `generateCurl()` | 3999-4015 | `RequestComposer.vue` |

### Recommended Migration Order Within Viewer

Start with the simplest tabs and work up:

1. **`EmptyState.vue`** — 4 lines of HTML
2. **`StorageTab.vue`** — Self-contained, ~140 lines JS
3. **`IssuesTab.vue`** — Self-contained, ~85 lines JS
4. **`ChangesTab.vue`** — Self-contained, ~60 lines JS
5. **`EnvironmentTab.vue`** — Self-contained, ~210 lines JS
6. **`ConsoleTab.vue`** — Filtering + table rendering, ~170 lines JS
7. **`NetworkTab.vue`** — Filtering + table + detail panel, ~300 lines JS
8. **`ScreencastPlayer.vue`** — Most complex standalone, ~400 lines JS
9. **`DashboardTab.vue`** — Ties together timeline, player, and sub-panels
10. **`HeaderBar.vue`** — Share dropdown, export, replay button
11. **`ReplayConfigModal.vue`** — Storage/request builders, ~300 lines JS
12. **`Viewer.vue` shell** — Sidebar nav, tab routing, file import

### CSS Extraction

The `viewer.html` `<style>` block (lines 6-1039) contains ALL viewer CSS. When porting:

1. **Copy the entire `:root` and `[data-theme="dark"]` blocks** → `Viewer.vue` `<style>` (unscoped)
2. **Copy component-specific styles** → each component's `<style scoped>`
3. **Shared classes** (`.action-btn`, `.badge`, `.filter-chip`, `.form-input`, etc.) → `Viewer.vue` `<style>` (unscoped) or a shared CSS file

---

## Conversion Patterns

### DOM Selection → Template Refs
```javascript
// BEFORE
const el = document.getElementById('myElement');
el.style.display = 'block';

// AFTER
const myElementRef = ref<HTMLElement | null>(null);
// In template: <div ref="myElementRef">
// In logic: myElementRef.value!.style.display = 'block';
// OR better: use v-show
```

### Event Listeners → Vue Events
```javascript
// BEFORE
btn.addEventListener('click', handler);

// AFTER
// <button @click="handler">
```

### Show/Hide → v-show / v-if
```javascript
// BEFORE
modal.style.display = 'flex';
modal.style.display = 'none';

// AFTER
const showModal = ref(false);
// <div v-show="showModal" class="modal">
```

### Class Toggling → Dynamic Classes
```javascript
// BEFORE
tab.classList.add('active');
tab.classList.remove('active');

// AFTER
// <div :class="{ active: isActive }">
```

### innerHTML with Data → Reactive Template
```javascript
// BEFORE
tbody.innerHTML = '';
items.forEach(item => {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${item.name}</td>`;
  tbody.appendChild(tr);
});

// AFTER
const items = ref<Item[]>([]);
// <tr v-for="item in items" :key="item.id">
//   <td>{{ item.name }}</td>
// </tr>
```

### Global Variables → Composables
```javascript
// BEFORE (viewer.js globals)
let currentReportData = null;
let currentConsoleSort = { key: 'time', dir: 'asc' };

// AFTER
// src/viewer/composables/useReportData.ts
const reportData = ref<ReportData | null>(null);
export function useReportData() {
  return { reportData, loadReport, clearReport };
}
```

### innerHTML Raw HTML → v-html (sparingly)
```javascript
// BEFORE
details.innerHTML = `<b>${escapeHtml(text)}</b>`;

// AFTER
// Use computed + template when possible
// Use v-html ONLY when HTML structure is truly dynamic:
// <div v-html="sanitizedHtml"></div>
```

---

## Shared Composables

### `useTheme.ts`
Used by: Popup ✅, Viewer, Editor, Content

```typescript
// src/shared/composables/useTheme.ts
import { ref, onMounted } from 'vue';

export function useTheme() {
  const theme = ref<'light' | 'dark'>('light');

  function apply(t: string) {
    theme.value = t as 'light' | 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }

  function toggle() {
    const next = theme.value === 'dark' ? 'light' : 'dark';
    chrome.storage.local.set({ theme: next });
    apply(next);
  }

  onMounted(() => {
    chrome.storage.local.get(['theme'], (r) => apply(r.theme || 'light'));
    chrome.storage.onChanged.addListener((changes, ns) => {
      if (ns === 'local' && changes.theme) apply(changes.theme.newValue);
    });
  });

  return { theme, toggle };
}
```

### `useReportData.ts`
Used by: Viewer (all tabs share the same report data)

```typescript
// src/viewer/composables/useReportData.ts
import { ref, computed, readonly } from 'vue';
import type { ReportData } from '@/shared/types/report';

const reportData = ref<ReportData | null>(null);

export function useReportData() {
  const hasData = computed(() => reportData.value !== null);

  const userEvents = computed(() =>
    (reportData.value?.userEvents || []).sort((a, b) => a.timestamp - b.timestamp)
  );

  const consoleErrors = computed(() => reportData.value?.consoleErrors || []);

  const networkEntries = computed(() =>
    reportData.value?.har?.log?.entries || []
  );

  function loadReport(data: ReportData) {
    reportData.value = data;
  }

  function clearReport() {
    reportData.value = null;
  }

  return {
    reportData: readonly(reportData),
    hasData,
    userEvents,
    consoleErrors,
    networkEntries,
    loadReport,
    clearReport,
  };
}
```

### `useScreencast.ts`
Used by: DashboardTab, ScreencastPlayer, TimelineTable

```typescript
// src/viewer/composables/useScreencast.ts
import { ref } from 'vue';

const currentIndex = ref(0);
const isPlaying = ref(false);
const frames = ref<ScreencastFrame[]>([]);

export function useScreencast() {
  function seekToTimestamp(timestamp: number) {
    let closest = 0;
    let minDiff = Infinity;
    frames.value.forEach((f, i) => {
      if (f.wallTime) {
        const diff = Math.abs(f.wallTime - timestamp);
        if (diff < minDiff) { minDiff = diff; closest = i; }
      }
    });
    currentIndex.value = closest;
  }

  return { currentIndex, isPlaying, frames, seekToTimestamp };
}
```

---

## Type Definitions

Create these in `src/shared/types/`:

```typescript
// report.ts
export interface ReportData {
  generatedAt: string;
  environment: Record<string, any>;
  storage: {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    cookies: Record<string, string>;
  };
  consoleErrors: ConsoleEntry[];
  userEvents: UserEvent[];
  screencast: ScreencastFrame[];
  issues: Issue[];
  contentChanges: ContentChange[];
  har: HarData;
}

export interface UserEvent {
  type: 'click' | 'input' | 'keydown' | 'navigation' | 'scroll';
  timestamp: number;
  target?: EventTarget;
  value?: string;
  key?: string;
  url?: string;
  piiMasked?: boolean;
}

export interface EventTarget {
  tagName: string;
  id?: string;
  className?: string;
  innerText?: string;
  xpath?: string;
  selectors?: string[];
  nearestHeading?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  testAttr?: { attribute: string; value: string; selector: string };
}

export interface ConsoleEntry {
  type: string;
  level: string;
  text?: string;
  message?: string;
  timestamp: number;
  url?: string;
  line?: number;
  column?: number;
  stackTrace?: { callFrames: StackFrame[] };
  _count?: number;
}

export interface StackFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

export interface ScreencastFrame {
  data: string;        // base64 image
  timestamp: number;
  wallTime: number;
}

export interface Issue {
  comment: string;
  timestamp: number;
  screenshot?: string; // data URL
}

export interface ContentChange {
  timestamp: number;
  type: string;
  xpath: string;
  oldValue?: string;
  newValue?: string;
}

// messages.ts — see Phase 3 above
```

---

## Testing Checklist

### Per-Component Checklist

After porting each component, verify ALL of these:

- [ ] **Visual match** — Compare side-by-side with original (same browser, same data)
- [ ] **Light theme** — All colors, borders, backgrounds correct
- [ ] **Dark theme** — Toggle theme, verify all elements update
- [ ] **All buttons work** — Click every button, verify expected behavior
- [ ] **All inputs work** — Type in every input/textarea, verify data flows
- [ ] **Modals** — Open and close every modal
- [ ] **Dropdowns** — Open every dropdown, click outside to close
- [ ] **Filter/search** — Test all filter chips and search inputs
- [ ] **Sorting** — Click table headers, verify sort direction toggles
- [ ] **Empty states** — Load with no data, verify empty messages show
- [ ] **Large data** — Load a large report file (>1MB), check performance
- [ ] **Chrome APIs** — `chrome.storage`, `chrome.runtime.sendMessage` calls work
- [ ] **Build succeeds** — `npm run build` produces correct output
- [ ] **Load in Chrome** — Install unpacked extension, everything functions

### Full Integration Test

After all phases complete:

1. Install extension in Chrome
2. Navigate to any website
3. Verify widget appears (if enabled in settings)
4. Click widget Start → Recording starts, widget shows Recording state
5. Perform clicks, type in inputs, navigate
6. Click Report → highlight an area → type issue
7. Click Stop → Viewer opens automatically
8. Verify Timeline tab shows all events
9. Click events → verify details panel updates
10. Switch to Console tab → verify log entries show
11. Switch to Network tab → verify requests show
12. Click a request → detail panel opens with headers/body
13. Try Replay → config modal opens → Start Replay → new tab opens
14. Take a screenshot → editor opens → draw on it → download
15. Export ZIP → import into fresh viewer → verify data integrity
16. Toggle dark theme → verify all pages update
17. Test webhook send → verify FormData is correct
18. Generate LLM Context → verify markdown output
19. Generate Playwright/Puppeteer scripts → verify syntax

---

## Known Issues

1. **Background script `"type": "module"`**: The manifest has `"type": "module"` for the background service worker. The original `background.js` is NOT a module — it works because Chrome is lenient. When porting to TS, the Vite output WILL be a module, so this is correct for the TS version. But if you remove `"type": "module"` now, the original script still works.

2. **Content script Widget.vue is a placeholder**: The current `src/content/components/Widget.vue` (83 lines) is NOT the real widget. The actual widget is built from `content.js` (2980 lines) which gets built as IIFE. The Vue Widget.vue needs a full port to replace it.

3. **JSZip dependency**: The viewer uses `jszip.min.js` from `public/`. When fully porting the viewer, either:
   - Install JSZip as an npm dependency: `npm install jszip`
   - Import it in the viewer Vue component
   - Or keep the CDN file approach

4. **JIRA helper**: `jira-helper.js` and `prompt.js` are loaded as separate scripts in the original HTML files. When porting, decide:
   - Port to TypeScript and import
   - Or keep as global scripts loaded via `<script>` tags in the entry HTML
