# Changelog

All notable changes to this project will be documented in this file.

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
