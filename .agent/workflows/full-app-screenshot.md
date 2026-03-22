---
description: Capture full application and specific component screenshots for the Signal Chrome Extension using the Antigravity Browser
---

# Workflow: Full Application Screenshots via Browser Subagent

This workflow outlines how to capture high-quality application states of the Signal Chrome Extension using the native Antigravity `browser_subagent` tool. Since the subagent automatically records its sessions as WebP videos in the artifacts directory, we can use it to visually document the user interface, component states, and complete user flows without needing external Puppeteer scripts.

### Phase 1: Environment Preparation (Serve the Application)
Since the `browser_subagent` needs an active HTTP endpoint to navigate to, we must serve the extension UI locally:
// turbo
1. Build the application: `npm run build`
2. Start the preview server: `npm run preview` in the background (typically runs on `http://localhost:4173`).

### Phase 2: Capture App Views via Browser Subagent
For each of the main views (Popup, Viewer, Screenshot Editor), start a `browser_subagent` session. Be sure to instruct the subagent to interact and allow sufficient wait times for Vue components to mount.

1. **Popup View**
   - Call the `browser_subagent` tool.
   - `TaskName`: "Capturing Popup View"
   - `RecordingName`: "popup_view_demo"
   - `Task`: "Navigate to http://localhost:4173/src/popup/index.html. Wait for the material design icons and components to render completely. Hover over the buttons to demonstrate interactive states, then return."

2. **Viewer App**
   - Call the `browser_subagent` tool.
   - `TaskName`: "Capturing Viewer App"
   - `RecordingName`: "viewer_app_demo"
   - `Task`: "Navigate to http://localhost:4173/src/viewer/index.html. Wait for the layout to stabilize. Click through the 'Timeline' and 'Network' tabs in the sidebar to capture the different states. If possible, expand a network request item, then return."

3. **Screenshot Editor**
   - Call the `browser_subagent` tool.
   - `TaskName`: "Capturing Screenshot Editor"
   - `RecordingName`: "screenshot_editor_demo"
   - `Task`: "Navigate to http://localhost:4173/src/screenshot-editor/index.html. Let the editor toolbar render completely. Interact with the drawing tools by selecting different colors or shapes if available, then return."

### Phase 3: Clean Up & Verification
1. Terminate the `npm run preview` background process running the static server.
2. The captured sessions are automatically preserved as `.webp` recordings in the `artifacts/` folder.
3. If specific still images are needed, the user can easily extract frames from these WebP recordings.
