# Changelog

All notable changes to this project will be documented in this file.

## [1.7.8] - 2026-05-16

### Added

- **Timeline: Console Errors**: JavaScript errors (console `error` level) now appear as rows in the Timeline table alongside user events, with an ERROR badge and the error message inline. Clicking a row opens a detail panel showing the full message, source URL, and stack trace if available.

- **Timeline: Failed Network Requests**: API calls (XHR and Fetch) that return a 4xx or 5xx status, or fail with no response, now appear as rows in the Timeline when the request targets the same domain or a subdomain of the recorded page. The badge shows the HTTP status code (e.g., 404, 500) or ERR for network-level failures. Clicking a row opens a detail panel with method, status, full URL, duration, and response body when captured. Static assets (scripts, stylesheets, images, fonts) are excluded so only meaningful API failures surface.

## [1.7.7] - 2026-05-08

### Added

- **Rolling Buffer: Video Capture**: A new "Video Capture" option in the Rolling Buffer tab takes periodic JPEG screenshots of the page (via Chrome's `captureVisibleTab` API) and stores them as a screencast in the committed snapshot, enabling visual video-style playback in the viewer. Choose an interval of 0.5, 1, 2, or 5 seconds. The settings panel shows a warning explaining that screenshots are only captured while the tab is the active, focused tab, and details the memory cost per frame (~50-200 KB each).

- **Rolling Buffer: DOM Frame Capture**: An optional setting in the Rolling Buffer tab lets you capture periodic DOM snapshots (outerHTML) into the buffer alongside events. Choose a capture interval of 2, 5, 10, or 30 seconds. A live debug toolbar appears in the bottom-right corner of the page showing frame count, estimated buffer size, and capture interval while active. A performance warning is shown in settings because serializing the full DOM on a large or complex page can affect page responsiveness.

- **Rolling Buffer**: A silent, always-on rolling buffer captures the last 2 minutes of debug context (console logs, JS errors, network requests, navigation events, user interactions) on configured domains. When a JavaScript error occurs or you press Alt+Shift+B, the buffer commits into a snapshot you can review in the viewer. Press Alt+Shift+P to pause buffering for 15 minutes, 1 hour, or indefinitely. The amber dot badge on the extension icon indicates when buffering is active. Buffering automatically pauses during manual recordings and resumes when the recording stops. Configure domains and buffer window in Settings under the new Rolling Buffer tab.

### Improved

- **App Tab: Navigation**: The App screen now uses a horizontal tab bar (App Info, Components, Store) to switch between framework info, the component tree, and state management. The Store tab is only shown when a state management library is detected. The default view is the Components tab, matching the Vue DevTools-style layout shown in the screenshot.

- **App Tab: UI Redesign**: The App screen has been fully redesigned to match the Signal design language. Framework cards are now compact inline cards with a coloured icon glow, monospace version numbers, and typed badges. The component tree uses a flat-list layout with depth indentation, a live search filter, expand/collapse controls, and colour-coded monospace tag names (Router components in purple, Base components in green, structural components in accent). Selecting a component opens a detail panel with separate Props and Data sections rendered as monospace key-value pairs.

### Fixed

- **Extension Update Prompt**: Fixed an issue where pages with the rolling buffer active would show the "extension was updated" reload prompt multiple times, requiring multiple clicks before the page actually reloaded. The prompt now appears exactly once regardless of how many background timers fire concurrently after an extension update.

- **Sandbox: CSS and assets missing in legacy snapshots**: Fixed an issue where rolling buffer DOM frame snapshots (Legacy HTML format) rendered as unstyled raw HTML in the Sandbox viewer. Three layers of fixes were required: (1) The HTML is processed through a DOM pipeline that strips captured-site CSP meta tags and absolutifies all relative URLs (`src`, `href`, `srcset`, `action`, `poster`, CSS `url()`) against the original page URL, matching how rrweb-snapshot handles this at capture time. (2) The loader switches from `srcdoc` to `doc.open()`/`doc.write()`, matching the rrweb-player approach so the iframe document has a stable URL for base-href resolution. (3) The viewer page's own CSP was broadened (`style-src *`, `font-src *`, `img-src *`) — when `doc.open()` sets the iframe document URL to the extension page URL, Chrome enforces the viewer page's CSP inside the iframe, and the previous `style-src 'self'` and `img-src 'self'` rules blocked all external stylesheets and images from captured sites.

- **Sandbox: Wrong URL on SPA frame snapshots**: Fixed an issue where all rolling buffer DOM frame snapshots were labeled with the URL from the start of the buffer session. Each frame now records `window.location.href` at the moment of capture, so frames captured after SPA navigation show the correct route in the snapshot dropdown.

- **Rolling Buffer: Snapshot on Interaction**: A new option in Rolling Buffer settings captures a DOM snapshot (outerHTML) after each click event. Snapshots are throttled to one per 500 ms to avoid bursts from rapid clicks. Each snapshot is stored as a `FrameEntry` and appears in the Sandbox snapshot picker correlated with the interaction in the timeline. The debug toolbar gains an EVT badge when this mode is active.

- **Rolling Buffer: Video Capture Quality**: Rolling buffer video frames now respect the screenshot quality and format settings configured for session recording (Settings: Recording Quality and Format). Previously the buffer video capture was hardcoded to JPEG at quality 50 regardless of user preferences. Note: the `captureVisibleTab` API only supports JPEG and PNG; if the session recording format is set to WebP, the buffer falls back to JPEG.

- **Rolling Buffer: Keyboard Shortcut Link**: Fixed the "change shortcuts" link in Rolling Buffer settings that did nothing when clicked. It now correctly opens the Chrome extensions shortcuts page in a new tab.

- **App Tab: Component Tree**: The redundant framework sub-tab is now hidden when only one framework is detected, removing the duplicate "Vue App" label. Vertical guide lines that appeared at fixed positions unrelated to tree depth are removed. Expand-all and collapse-all buttons now use distinct double-chevron icons (down and up) so they are no longer visually identical. The copy button in the component detail panel now copies the component name, props, and state to the clipboard. The "Go to source" button is enabled when a workspace with a local path is configured and opens the component source file (or the workspace folder) directly in VS Code. Added top margin before the component tree section for better visual separation. Component source file paths are now captured from Vue's internal `__file` property when available.

## [1.7.6] - 2026-04-28

### Fixed

- **Viewer**: Fixed a blank viewer screen caused by a temporal dead zone error where the workspace-match watcher was registered before `isWorkspaceMatched` was declared, crashing the setup function silently.

### Improved

- **Workspaces: Configure Workspace Modal**: The workspace creation modal now asks for a workspace name (required) instead of a domain, which is now derived automatically from the recording. The local path field is optional and accepts both a project folder and a VS Code `.code-workspace` file. Recorded domains are added to the workspace automatically as web services.
- **Network Tab: Add Domain to Workspace**: Requests from domains other than the main recording domain now show a "+ workspace" button on hover. Clicking it adds that domain as a service to the matched workspace, making it easy to include APIs and third-party endpoints.
- **App Tab: Component Tree**: Vue component trees are now captured from production builds. A pre-mount hook is injected at page load into the main JavaScript context, which causes Vue 3 to expose component instances on DOM elements even when built for production. The App tab now shows the full tree, props, and setup state for any Vue app recorded by Signal.

### Added

- **Integrations: Playwright and Puppeteer**: Playwright and Puppeteer script generators are now listed as integrations in the Settings panel. Each has a "Show in context menu" toggle that controls whether the script export option appears in the viewer's share menu. Both are hidden by default.
- **Report Details: Custom Logs**: Users can now add custom key-value log entries to the Report Details card on the Environment tab using the new "Add" button. Entries are saved to the report and automatically included in the LLM context when the Report Details section is enabled.

### Improved

- **Screencast Recording**: Clicking Screencast in the popup now opens Chrome's native screen picker immediately. The recorder window launches and triggers the picker automatically, so there is no extra "Start Recording" button to click. After saving, the window closes itself.

### Fixed

- **Logs Tab**: Sentry integrations no longer show "No provider found for this integration." when fetching logs. The Sentry provider is now implemented: in Mock mode it calls the local mock server at `:3002`, and in live mode it calls the Sentry API using the configured org slug, project slug, and auth token.
- **Workspace Matching**: The viewer now correctly resolves the matched workspace from the Workspace Builder definitions (the `workspaces` array) rather than only the legacy `domainWorkspaces` key-value store. A recording from a domain that has a workspace configured will now properly match, enabling the Open in VS Code button and the Logs tab.
- **VS Code Path Resolution**: When a workspace is matched, the VS Code path is derived from the workspace-level VS Code integration (or `localPath` as fallback), so the Open in VS Code button appears as soon as a VS Code integration is configured in the Workspace Builder.
- **Configure Workspace Button**: The Configure Workspace header button now only appears when the recording domain has no matching workspace entry at all. Previously it appeared whenever no VS Code path was set, even if a workspace was already configured.
- **Logs Tab Visibility**: The Backend Logs tab in the sidebar now only appears in Dev mode. It was previously visible in Reporter and Editor modes where workspace features are not relevant.
- **Replay Button**: The Replay primary button in the header now shows only when no workspace is matched for the current domain, consistent with other workspace-aware header controls.

### Added

- **Camera Recorder**: A new "Record Camera" option in the popup Video section opens a dedicated recorder window that captures webcam video and microphone audio together, saving the result as a .webm file. The recorder shows a live mirrored preview and an elapsed timer while recording.
- **Collapsible Popup Sections**: The Screenshot and Video sections in the popup are now collapsed by default, keeping the Record Session button prominent. Clicking the section header expands or collapses the section. Inside the Video section, Screencast (screen, camera and mic) is now the primary hero button, with Record Tab, Camera, and Screen+Audio as smaller secondary options below.

- **Collapsible Sidebar**: The viewer sidebar can now be collapsed to an icon-only rail by clicking the chevron button in the header. The collapsed state persists across sessions. Tab labels appear as tooltips when hovering in collapsed mode.

- **Backend Logs Tab**: A new Backend Logs tab appears in the viewer when any observability node (Azure Log Analytics, and future providers like Sentry and Grafana) is configured and connected in the Workspace Builder. Each connected service gets its own sub-tab with severity and text filtering.
- **Network Request Correlation**: Requests in the Network tab now display a badge showing how many backend log entries were matched. Expanding a request reveals those logs inline, correlated via distributed trace IDs (`traceparent`, `x-request-id`, or any custom header) with a time-window fallback when no trace header is present.
- **Azure Demo Account**: The azure-logs node in the Workspace Builder now has a "Use Demo Account" toggle that queries Microsoft's public Azure Log Analytics demo workspace. No credentials are needed, making it easy to explore the feature immediately.
- **Workspace Builder Button**: The Builder button is now visible in Settings, Workspaces for each domain mapping.
- **Backend Logs: Resizable Columns**: Columns in the Backend Logs tab can be resized by dragging the header dividers, with widths persisting for the duration of the session.
- **Backend Logs: Row Detail Modal**: Each log entry now has a "Show" button that opens a modal displaying all fields. JSON values are automatically pretty-printed. Each field value can be copied to the clipboard individually.
- **Workspace Builder: Services Section**: Each workspace definition now has a Services section where you can add named service entries (web app, backend API, database, external service) with label and URL. Integrations can be scoped to specific services or applied to all.
- **Workspace Builder: Integration Type Picker**: The workspace builder now supports four integration types: Azure Log Analytics, Sentry, Grafana (Loki), and VSCode. Each type has a dedicated config form.
- **Workspace Builder: Custom KQL Editor**: Azure Log Analytics integrations now include an editable KQL textarea with inline validation. The query must contain `{START}` and `{END}` placeholders and project `TimeGenerated` and `Message`. The default query targets `AppExceptions` with `Message=OuterMessage` and `Details` as context. Result columns are displayed dynamically based on what the query projects.

## [1.7.5] - 2026-04-18

### Added

- **Workspace Builder**: A new DEV mode settings tab lets you define your app's architecture by adding frontend and backend/API servers. Each backend or API server can be independently connected to a log system for enhanced debugging.
- **Azure Logs Integration (EXP)**: Backend and API servers in the Workspace Builder can now be connected to Azure Log Analytics. Settings include Workspace ID, Shared Key, Log Type, and endpoint override. A "Use Mock Server" toggle routes requests to the local mock at `localhost:3001` for development, with a built-in connection test button.
- **Jira Issue Type Auto-fetch**: When adding a mapping in Project Mapping settings, the Jira Issue Type field now auto-fetches available issue types from your configured Jira project and shows a dropdown instead of a free-text input. Falls back to manual text input if the fetch fails or no project key is set.
- **Jira Description Templates migration**: Jira description templates saved under the old top-level storage key are automatically migrated into `settings.jiraTemplates` on first load so no reconfiguration is needed.
- **Copy Steps — Timeline tab**: Two new buttons appear above the event list when steps are available: "Copy steps" copies repro steps as plain text; "Copy as Jira" copies a pre-filled Jira markdown block (steps, environment URL) ready to paste into any Jira ticket without opening the modal.
- **HAR Multi-type Filter**: The Network tab filter bar now supports selecting multiple resource types at once (XHR, JS, CSS, Img, Doc, Font, Other). Click a type chip to toggle it; click "All" to clear all filters.
- **Tab-switch Prompt During Recording**: When the user switches to a different tab while a recording is active, Signal detects the focus change and shows a prompt in the popup with three options — switch the recording to the new tab, keep recording the original tab, or stop recording entirely. The prompt also appears when the popup is reopened after a tab switch.
- **Video Trimmer**: When downloading a session recording as WebM, a trimmer modal now appears so users can select a start and end point before exporting. The modal shows a live frame preview, a dual-handle timeline slider, and a play button to preview the trimmed clip before downloading.

### Fixed

- **Jira Description Templates not displaying**: Templates saved in settings were not shown in the Description Templates tab because Vue reactive arrays were serialized to storage as plain objects (`{0:{…}}`) instead of JSON arrays. All reactive collections are now spread into plain arrays before saving, and the load path handles both formats for existing users.

### Improved

- **Jira Settings — Tabbed Layout**: The Jira integration settings page is now split into three focused tabs — Connection Details, Project Mapping, and Field Configuration — so each concern is configured separately rather than scrolling through a single long form. The Project Mapping and Field Configuration tabs are disabled until the connection credentials have been filled in and saved.
- **Repro Steps — Element Names**: Steps to reproduce now resolve the best human-readable label for each element using a priority chain: `aria-label` → `placeholder` → `title` → `alt` → inner text → element ID. Opaque identifiers like "clicked A" or "clicked DIV" no longer appear in generated steps.
- **Repro Steps — Human Tone**: Steps now use imperative action verbs ("Click", "Type", "Navigate to", "Press") instead of raw event type names. Element labels are bolded for readability (e.g. "Click **Submit Form**" instead of "click on BUTTON#submit").
- **Repro Steps — Noise Filtering**: When a recording has DOM diff or network context data, Signal now filters out clicks that produced no observable side effect within 300ms (no navigation, no DOM mutation, no network request). This removes accidental or redundant clicks from repro steps automatically.

## [1.7.4] - 2026-04-13

### Added

- **JIRA Description Templates**: Define per-project and per-issue-type description templates in Settings → Integrations → Jira. Templates use `{{tags}}` that are automatically populated with recording data (starting URL, steps to reproduce, console errors, network errors, reported issues). Use `*` as a wildcard to create a catch-all template. The description field remains editable after a template is applied.
- **JIRA Summary Auto-population**: When a report has a name (set via Report Issue), it is automatically pre-filled as the JIRA ticket summary.
- **JIRA Attachment Selection**: The "Create JIRA Ticket" dialog now shows a multiselect for attachments — choose any combination of the recording file (JSON/zip/gzip), a WebM video of the screencast, and screenshots from reported issues. Select "No attachments" to skip all.
- **JIRA Issue Type Mapping**: Map JIRA issue types to Signal recording types in Settings to auto-select the right default attachments when creating a ticket.
- **Framework Component Detection**: When reporting an issue, Signal now detects the React, Vue, or Svelte component that owns the highlighted element. The component name (e.g. `ProductCard`) is shown as a colour-coded badge in the Report Issue dialog, the Issues tab, and is included in the LLM context so the AI agent knows exactly which component to investigate. Detection runs in the page's main JS world so React fiber and Vue instance properties are fully accessible.

### Fixed

- **Report Issue — Multiple Highlights**: The selection rectangle is now hidden as soon as the Report Issue dialog opens, eliminating the double-highlight confusion.
- **Report Issue — Widget Visibility**: The floating widget is now hidden while the user is drawing a selection or has the Report Issue dialog open, and is restored automatically when the dialog closes.

### Improved

- **Report Issue Dialog**: The "Report Issue" modal now uses the same dark theme as the rest of the viewer (dark background, muted labels, blue-tinted accents, full-screen backdrop) instead of a plain white box.

## [1.7.3] - 2026-04-12

### Added

- **Editor Mode — Clear Data**: In Editor mode, the Console Errors, Network (HAR), and Issues tabs each show a "Clear All" button in their toolbar. Clicking it removes all entries of that type from the report, letting developers strip noise before exporting or sharing.
- **Settings — Experimental Tab**: The viewer Settings panel now has an "Experimental" tab consolidating four experimental features: App Context detection (toggle to enable/disable framework and state capture), HTML Snapshots (moved from the former "Isolation Replay" tab), Buffered Recording (toggle to show/hide the Buffered mode button in the popup, with Buffer Duration setting), and Sourcemaps (moved from the per-domain Workspaces cards into a dedicated section).
- **Popup — Record Video**: A "Record Video" card appears in the popup's Record tab. Clicking it starts capturing the current tab's video using `MediaRecorder` and saves the result as a `.webm` file via the browser's download system. Clicking the card again stops the recording and triggers the download immediately.

### Improved

- **Popup — Settings Section**: The SETTINGS section in the popup is now hidden when it contains no visible rows (i.e. when in Record mode with Buffered Recording disabled), keeping the interface clean.
- **Popup — Screenshot and Video Section**: The CAPTURE MODE section has been redesigned — the tab toggle is removed, screenshot options and the video recording button are shown together in one "Screenshot and Video" section (with an icon in the title). The video button moves to the bottom of the grid, spanning the full width. The Settings row (screenshot delay) has been removed from the popup.
- **Popup — Separated Screenshot and Video Sections**: The combined "Screenshot and Video" section is now split into two distinct sections — "Screenshot" (with Visible View, Selected Area, and Entire Page) and "Video" (with Record Tab), making each capture type easier to identify at a glance.

## [1.7.2] - 2026-04-10

### Added

- **Workspaces Settings**: An info banner at the top of the Workspaces settings tab now highlights that the Signal VS Code extension is available, explains how it enables improved debugging and AI Agent delegation &amp; debugging, and links directly to the VS Code Marketplace install page.
- **Configure Workspace shortcut**: In Developer mode, when a report's domain has no local workspace mapped, a "Configure Workspace" button now appears in the viewer header. Clicking it opens a modal pre-filled with the report domain where the developer can enter the local folder path and save the mapping without leaving the report view. The "Open in VS Code" button appears immediately after saving.

### Improved

- **Open in VS Code**: VS Code is now opened exactly once. A session ID is pre-generated and embedded in the opening URI so the Signal VS Code extension begins polling for the session the moment it activates. The Chrome extension races to POST the session data to MCP within a 60-second window — no second window.open is needed. If the Signal extension is not installed and MCP never responds, a clear message is shown after the timeout suggesting the user installs the extension from the VS Code Marketplace.

## [1.7] - 2026-04-08

### Fixed

- **Widget Stop Flow**: Stopping a recording from the on-page widget now shows a "Save Recording" form inline in the widget, prompting for a report name and type before saving — matching the experience when stopping from the extension popup.
- **Save Report Form**: The report-naming form now renders as a full popup page instead of a scrollable overlay, so Chrome auto-sizes the popup to fit all fields and buttons with no scrollbar.
- **Recording State Sync**: The popup and the on-page widget now stay in sync in both directions. Stopping from the popup now notifies the widget to return to idle state; the popup polls for status every 1.5 seconds so it reflects widget start/stop actions in real time.

### Added

- **Report Naming**: When recording stops, a dialog prompts for a report name (required), type (Bug, UX Feedback, Improvement, Other — Bug is the default), and an optional description. The name and type badge appear in the viewer header and a Report Info card is shown at the top of the Details tab. The report info can be edited at any time using the pencil button visible in Editor mode. Skipping the dialog saves the report without metadata.
- **User / Developer Mode Switcher**: A toggle in the report viewer header switches between User and Developer modes. In User mode the interface is simplified — Import, Open in VS Code, LLM Context, Playwright and Puppeteer scripts, the App navigation tab, and the Workspaces settings section are all hidden. The primary action in User mode is the Share button. In Developer mode the full toolset is available: Import, Open in VS Code (promoted to primary when a workspace is mapped; Replay becomes primary otherwise), and a three-dot menu containing all export, script generation, and automation options. The selected mode persists across sessions.

## [1.6] - 2026-04-06

### Added

- **LLM Context Token Indicator**: A circular arc indicator in the LLM Context modal header shows estimated token usage against the selected model's context limit (Claude 200K, GPT-4o 128K, Gemini 1.5 1M, Llama 3 128K). The arc turns yellow at 70% and red at 90%, with a tooltip showing the exact percentage. Model preference persists across sessions.
- **LLM Context Configuration**: Clicking "LLM Context" now opens a two-panel modal with a live preview and a config sidebar. Developers can choose exactly what data to include: environment, user events, user-reported issues, console errors, bug classification, failed requests (filterable per domain), request payloads, response bodies (both redacted via the redaction engine), and a storage snapshot. Settings persist across sessions.
- **Workspace Mappings**: Map domains to local project folders in Settings → Integrations. When the active tab's domain matches a saved mapping, an "Open in VS Code" button appears in the popup footer to instantly open the project.
- **Data Redaction Engine**: Sensitive data is now automatically redacted at report-generation time — before anything is written to storage or exported. The engine covers all six capture surfaces: URL query parameters, request/response headers, request/response bodies (JSON, form-encoded, and plain text), console logs, storage (localStorage / sessionStorage / cookies), and DOM snapshots. Built-in rules always redact auth headers, cookies, JWT tokens, AWS access key IDs, email addresses, credit card numbers, and common sensitive JSON keys (password, token, secret, api_key, CVV, SSN, etc.).
- **Custom Redaction Rules**: Developers can define project-specific rules in Settings. Four rule types are supported: `header-name` (redact a specific HTTP header value), `query-param` (redact a URL query parameter by name), `json-key` (redact a JSON field anywhere in a request/response body), and `regex` (apply a custom pattern to a chosen scope). Rules can be individually enabled or disabled.

## [1.5] - 2026-03-30

### Fixed

- **Widget Styles**: Widget component styles are now inlined directly into the content script bundle at build time, eliminating an intermittent "Failed to fetch" error that occurred when the background service worker could not retrieve the stylesheet.

### Added

- **Export Optimization**: All recording exports (JSON, ZIP, GZIP, Video) now automatically optimize the data before writing — duplicate adjacent screencast frames are removed and HAR response bodies for static assets (scripts, stylesheets, images, fonts) are stripped. This makes exports smaller even for recordings captured before these settings were introduced.
- **Event Screenshot Mode**: New recording option "Screenshots on Event Only" that captures a single screenshot per user action (click, key, scroll) instead of a continuous video stream. Dramatically reduces report size for sessions where video playback is not needed — each event still has a visual context without the overhead of full screencast recording.
- **Jira Required Fields**: The Jira integration settings now support defining project-specific required fields (e.g. custom fields unique to each Jira project) with a field key, display label, and default value. Includes a Project Key field and a note clarifying that self-hosted Jira Server / Data Center instances work alongside Jira Cloud.
- **Configurable Export Format**: Recording exports (JSON / ZIP / GZIP) are now consolidated into a single "Export Recording" button. The format is configured once in Settings → Recording and defaults to GZIP (.json.gz) for the smallest file size. Each format option shows a description of its trade-offs.
- **HAR Response Body Capture**: New opt-in setting ("Capture API Response Bodies") in the Recording tab of Settings. When enabled, response bodies for XHR/Fetch requests are stored in the HAR. Off by default to keep report sizes small. A configurable size cap (default 100 KB) prevents any single body from bloating the report.
- **Settings Page in Viewer**: The Report Viewer now has a dedicated Settings tab (gear icon) where users can configure all extension preferences — widget visibility, click animations, mouse trail, buffer duration, notification toasts, recording quality (format, FPS, quality), Isolation Replay options (HTML snapshots, DOM diff tracking), security redaction rules (headers, storage keys, cookies), and Jira integration — without needing to open the popup.
- **Recording Quality Settings**: New settings in the popup for Frame Format (JPEG or WebP — WebP reduces recording size by 25–35%), Frames Per Second (1–30, default 24), and Image Quality (0–100%, default 80%), giving fine-grained control over recording size versus fidelity.
- **Export as ZIP**: The report viewer can now export recordings as a compressed ZIP archive containing the JSON report, making it easier to share and store large recordings.
- **Export as GZIP**: Reports can be exported as `.json.gz` files using native browser gzip compression, offering significantly smaller file sizes for sharing. The viewer can also import `.gz` files.
- **Download as Video (WebM)**: The report viewer can convert a screencast recording into a downloadable WebM video file directly in the browser using Canvas and MediaRecorder, with no server required.
- **Manual Snapshot Capture**: Snapshots are no longer captured automatically on page load. Instead, a "Snapshot" button appears in the recording widget (when HTML Snapshots are enabled), letting you capture the exact page state at the moment you choose.
- **DOM Diff Tracking Toggle**: DOM mutation tracking is now an explicit opt-in setting ("Track DOM Changes") within the Isolation Replay section, disabled by default. This prevents unnecessary report size growth for users who do not need fine-grained DOM replay.

### Fixed

- **Network Deduplication**: Duplicate network requests (same URL and HTTP method within a 100 ms window) are now filtered from the HAR output, eliminating noise caused by browsers and libraries firing the same request multiple times in rapid succession.
- **Environment Tracking**: The content script now captures `platform`, `timezone`, and `cookieEnabled` in addition to the existing environment fields. Older reports that omit these fields continue to open without issue.
- **Environment Display**: The Details tab now correctly displays screen size, window size, and pixel ratio from reports recorded with the current format (separate numeric fields `screenWidth`/`screenHeight` etc.), which were previously showing as N/A.
- **Issue Highlight Box**: Fixed the issue screenshot highlight overlay failing to render because it referenced a non-existent `windowSize` object — it now supports both the current numeric format and the legacy string format.

### Improved

- **Screencast FPS Fix**: The `everyNthFrame` calculation now uses Chrome's actual 60 Hz V-sync rate (previously assumed 24 fps) and removes an incorrect cap of 10, so configured FPS values like 4 fps now correctly produce ~4 fps instead of ~10 fps. Duplicate frames (identical pixel data) are also discarded before storage.
- **HAR Size Reduction**: Response bodies for static assets (scripts, stylesheets, images, fonts) are no longer captured by default, eliminating the most common source of inflated report sizes. JS bundles and images alone accounted for 14+ MB in a typical recording.
- **Empty State Consistency**: The Issues, Sandbox, and App tabs now use a consistent empty-state layout (icon + title + description) when there is no data to display.

## [1.4] - 2026-03-01

### Fixed

- **Timeline Event Management**: Corrected a state mutation bug that prevented the timeline UI from updating dynamically when a user event was removed while in Edit Mode.
- **Replay Event Removal**: Fixed an issue where clicking the remove button on a replay event would not immediately update the UI list despite successfully deleting it from storage.
- **Replay Widget Styling**: Corrected build errors caused by improperly linked Tailwind CSS files in the shadow DOM, opting instead for pure semantic CSS matching the design system requirements.
- **Replay Widget Visibility**: Replay Widget now correctly hides itself entirely when there are zero events available to replay, preventing it from showing an empty "0 / 0" state.
- **Recording Widget State Persistence**: Fixed a bug where the floating Recording Widget (pill) would fail to reappear across page navigations while recording was still actively running in the background.
- **Widget Content Flash**: Prevented the widget from displaying unstyled content briefly by delaying its visibility until the CSS stylesheet is fully loaded from the background script.
- **Recording Widget Replay Conflict**: The floating Recording Widget (Start/Stop) is now hidden when the system is actively in Replay Mode to prevent overlap and confusing state actions.
- **Replay Widget Mount Failure**: Fixed an issue where the Replay Widget would completely fail to render during a replay session due to its underlying Vue App instance being improperly reused across page mounts instead of being completely destroyed and recreated.
- **Replay Widget State/Button Bugs**: Repaired multiple state issues: the 'Starting...' status now correctly clears when an event executes, the 'Replay Again' feature was restored with proper styling and click events, and removing a recorded event from the list correctly updates the UI natively.
- **Replay & Timeline Consistency**: Addressed discrepancies where replay data mapping would desync when rendering timeline events.
- **Timeline Details Visibility**: Expanded the Viewer timeline details sidebar to properly populate data for "Console" and "Issue/Report" event types.
- **Selected Area Screenshot**: Added missing `pointer-events` to the region selection box, allowing the screenshot selection completion mechanism to trigger properly.
- **Issue Report Highlights**: Restored screenshot thumbnails and red bounding box highlights in the Viewer for reported issues using dynamic CSS overlays and closest-frame calculations.
- **Replay Delay Dropdown**: The delay dropdown was hidden during replay execution due to an overly restrictive `v-show` condition. It is now visible throughout the entire replay session, allowing users to change delay mid-replay.
- **Replay Skip/Stop Visibility**: Skip and Stop buttons are now hidden when replay hasn't started yet, preventing confusion in ready mode.
- **Replay Double-Refresh**: Clicking "Replay Again" no longer triggers multiple page refreshes. The restart handler now detects if the tab is already on the correct URL and performs a single reload instead of navigating and then reloading.
- **LLM Export Viewport Dimensions**: Fixed an issue where the viewport was incorrectly rendering as `undefinedxundefined` in the generated LLM Context due to structural mismatches with the EnvironmentData object.

### Added

- **Cross-Tab Navigation**: Clicking on specific network requests or console logs within the Timeline details panel now seamlessly redirects you to the respective Network or Console tab, clears active filters, automatically highlights the element, and smoothly scrolls it into view.
- **Replay Pulsating Highlight**: Before each replay event executes, a pulsating blue glow effect highlights the target element on the page so the user can see exactly where the action will happen.
- **Report Generation Feedback**: The floating Recording Widget now visibly indicates "Generating Report..." with a loading spinner after stopping a recording, providing immediate feedback while the background process saves the report before the Viewer opens. The "Report" button also shares this feedback state as "Generating Export...".
- **Replay Element Inspector**: Added a new inspect (`🔍`) button to each event in the replay widget. It highlights the target element in the live viewport and logs the DOM node directly to the console for deep inspection.
- **Granular Storage Clearing**: Replay Configuration now allows selecting specific storage types (Local/Session Storage, Cookies, IndexedDB) to securely wipe from the starting domain before a replay begins.
- **Network Request Copying**: Added convenient "Copy as Fetch" and "Copy as cURL" buttons to the network request details panel for easy API debugging.
- **Fullscreen Video Controls**: Added native-like controls (Play/Pause, scrub bar, time display) overlayed when viewing the timeline screencast in full-screen mode.

### Improved

- **LLM Context Noise Reduction**: Removed storage info, third-party network failures, completely excluded third-party console errors, filtered out noisy browser/network errors (`net::ERR_ABORTED`, `net::ERR_BLOCKED_BY_CLIENT`), HAR timing, slowest requests, and status code breakdown from the LLM Export context. This dramatically reduces noise and context length, allowing the AI to focus strictly on first-party application logic and exceptions.
- **Test Coverage**: Added missing unit test for `ErrorToast.vue` and fixed selectors in `ReplayWidget.test.ts` to ensure all Vue components are fully tested.
- **Replay Widget Design**: Completely redesigned the Replay Widget styling to an elegant Deep Blue dark mode (Variant 1) without requiring external dependencies, establishing a premium look and feel.
- **Finished Replay Actions**: Replaced the stuck "Starting..." button with a dynamic "Restart Replay" or "Replay Again" button once a replay concludes to allow seamless testing loops.
- **Brand Update**: Updated the Lighthouse logo to a custom `.bug-beetle` SVG representing the official Signal extension icon.
- **LLM Shared Context**: Replaced the generic share icon under the "LLM Context" menu action with a prominent Sparkles ✨ icon in the Viewer.
- **Empty States**: Standardized empty state messages across viewer tabs (Console, Network, Storage, Issues) to share consistent styling, prevented hover and click interactions, and removed unnecessary bottom borders on table rows.
- **Robust Automation Scripts**:
  - Playwright: Now initializes with `browser.newContext()` to simulate viewport and locale, and uses modern `page.locator()` syntax instead of older click methods.
  - Puppeteer: Generated scripts now utilize intelligent `clickXPath` and `fillXPath` helper functions to avoid scope redeclaration errors.
- **Fullscreen Video Scaling**: Forced CSS `!important` bounds to ensure the playback video properly expands to fit the maximum screen size in fullscreen mode without being constrained by inline styles.
- **Replay State Syncing**: Fixed an issue where inspecting the Replay Widget after removing an event would incorrectly target the previous element at that index.
- **Clean Screenshots**: The Signal recording widget now properly hides itself immediately before capturing the viewport, guaranteeing pristine screenshots without UI overlap.

## [1.3] - 2026-02-15

### Added

- **Error Toast Notifications**: On-screen toast messages now appear in real-time during recording whenever a `console.error` fires, an uncaught exception is thrown, or a network request fails (HTTP 4xx/5xx or connection error). Toasts auto-dismiss after 5 seconds, stack up to 5, and visually distinguish console errors (red) from network errors (orange).
- **Webhook Sharing**:
  - New "Share via Webhook" modal for sending reports to external services.
  - Fully configurable `multipart/form-data` FormData template — users define field names and values via a JSON editor.
  - `%export%` and `%screenshot%` variables attach the compressed report (.zip) and current screenshot (.jpg) under any field name.
  - Custom HTTP method, headers, and persisted settings via `localStorage`.
- **Replay Environment Configuration**:
  - New Replay Configuration modal with tabbed interface (General, Local Storage, Session Storage, Cookies, Pre-flight Requests).
  - Inject localStorage, sessionStorage, and cookie key-value pairs before replay begins.
  - Pre-flight AJAX request builder — define requests (method, URL, headers, body) to execute before replay (e.g., fetch auth tokens).
  - Storage items pre-populated from the loaded report data.
  - Option to clear existing storage before injection.
- **Security & Anonymization**:
  - New Security tab in popup settings for configuring sensitive data redaction.
  - Configurable lists of headers, localStorage keys, and cookies to anonymize in exported reports.
  - Default sensitive keys provided (Authorization, Cookie, Set-Cookie, token, session, etc.) with a "Load Defaults" button.
  - Report data is automatically redacted before export based on user-configured lists.
- **Request Composer**:
  - Built-in HTTP request composer with tabbed interface (Request, Headers, Body, Response).
  - Support for GET, POST, PUT, DELETE, PATCH methods.
  - Network entries can be re-sent directly from the network detail panel via "Open in Composer" action.
  - Response viewer showing status, headers, and body.
- **Timeline Enhancements**:
  - Embedded Console and Network sub-tabs within the Timeline view with filtering and search.
  - Timeline is now the primary tab (visually distinguished in sidebar navigation).
- **Resizable Detail Panel**:
  - Details sidebar (Console/Network views) can be resized by dragging its left edge.
  - Visual resize handle with hover/active highlight, min/max width constraints (280px–70vw).
- **Click Indicator Customization**:
  - New color picker for click indicators in popup settings.
  - Click recording settings visually grouped and disabled when click recording is off.
- **Settings Redesign**:
  - Popup settings reorganized into tabbed layout: General, Security, Integrations.
  - Toggle switches for widget and click visibility with improved styling.

### Improved

- **Performance**:
  - `renderConsole` and `renderNetwork` now use `DocumentFragment` for batch DOM insertion, preventing browser freezes on large datasets.
  - Removed redundant `allEvents` array construction in `renderReport`.
- **Light Mode**:
  - Fixed unreadable badge colors (error, warning, success, info) in light mode — now use high-contrast dark text variants.
  - Applies to both console level badges and network status badges.
- **Report Import**:
  - Added support for importing `.zip` report files alongside raw `.json`.
  - `globalAllEvents` is populated safely even if `renderTimeline` encounters an error.
- **Empty State**:
  - Proper empty state messaging when no report is loaded.

### Fixed

- **Encoding Issues**:
  - Replaced raw Unicode characters (✓, ✗, —) with HTML entities in webhook status messages to prevent garbled text.
  - Fixed em-dash encoding in webhook variable legend.

## [1.2]

### Added

- **UI & Design**:
  - **New Design**: Refreshed the interface with a modern aesthetic, including updated typography and layout components.
  - **Dark Mode**: Fully implemented Dark Mode support for the Report Viewer.
  - **Brand Update**: Updated the application logo to a modern, "slick" Lighthouse design with a single beam in both the Report and Popup.
  - **Controls**: Added Play/Pause icons to the video player controls for better usability.
- **Recording Features**:
  - Added an option to **Cancel Recording** directly from the extension interface.
- **Console Logging**:
  - Considerably expanded console log capturing capabilities.
  - Added support for `info`, `log`, `verbose`, `debug`, and extended console methods (`dir`, `table`, `trace`, `count`, `timeEnd`).
  - Implemented capture of Uncaught Exceptions (`Runtime.exceptionThrown`).
  - Synthesized console error logs from Network Failures (`Network.loadingFailed`) and HTTP Errors (Status >= 400).

### Fixed

- **Screenshot Functionality**:
  - Resolved issue where taking multiple screenshots caused dimming due to stacked overlays (implemented overlay cleanup in `content.js`).
  - Fixed duplicate screenshot process initialization by adding a state guard.
  - Removed unwanted red rectangle highlight when opening the screenshot editor for region captures.
- **Console Reporting**:
  - Fixed an issue where the "No console errors match filter" message would persist even after logs were loaded.
  - Resolved timestamp discrepancies that caused some logs to be incorrectly pruned (normalized timestamps to milliseconds).
- **Popup UI**:
  - Fixed visibility of Play/Pause icons in the recording widget by using filled SVG shapes.
