# Changelog

All notable changes to this project will be documented in this file.

## [1.4] - 2026-03-01

### Added
- **Replay Element Inspector**: Added a new inspect (`🔍`) button to each event in the replay widget. It highlights the target element in the live viewport and logs the DOM node directly to the console for deep inspection.
- **Granular Storage Clearing**: Replay Configuration now allows selecting specific storage types (Local/Session Storage, Cookies, IndexedDB) to securely wipe from the starting domain before a replay begins.
- **Network Request Copying**: Added convenient "Copy as Fetch" and "Copy as cURL" buttons to the network request details panel for easy API debugging.
- **Fullscreen Video Controls**: Added native-like controls (Play/Pause, scrub bar, time display) overlayed when viewing the timeline screencast in full-screen mode.

### Improved
- **Robust Automation Scripts**:
  - Playwright: Now initializes with `browser.newContext()` to simulate viewport and locale, and uses modern `page.locator()` syntax instead of older click methods.
  - Puppeteer: Generated scripts now utilize intelligent `clickXPath` and `fillXPath` helper functions to avoid scope redeclaration errors.
- **Fullscreen Video Scaling**: Forced CSS `!important` bounds to ensure the playback video properly expands to fit the maximum screen size in fullscreen mode without being constrained by inline styles.
- **Replay State Syncing**: Fixed an issue where inspecting the Replay Widget after removing an event would incorrectly target the previous element at that index.

## [1.3] - 2026-02-15

### Added
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
