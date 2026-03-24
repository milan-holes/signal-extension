---
description: Test all screenshot modes securely using native browser subagent
---
# Testing Screenshots Workflow

This workflow verifies the three screenshot modes (Visible Area, Selected Area, Whole Page) using the native browser integration (`browser_subagent`).

**Important Note**: Screenshots should be triggered **without** starting a recording beforehand.

## Steps

1. **Build & Refresh the Extension**
   - Run `npm run build` locally to compile any new changes.
   - Instruct the `browser_subagent` to navigate to `chrome://extensions`.
   - Locate the `signal-extension` card.
   - Click the "Refresh" (reload) icon on the extension card to update it.

2. **Navigate to the Test Page**
   - Instruct the subagent to open a webpage, like `https://example.com`.

3. **Test Visible Area Screenshot**
   - Click the Signal widget screenshot dropdown button.
   - Click "Visible Area".
   - Verify that the screenshot editor opens in a new tab.

4. **Test Selected Area Screenshot**
   - Click the Signal widget screenshot dropdown button.
   - Click "Selected Area".
   - Use the subagent to click and drag across the screen to define the screenshot region (e.g. mousedown at 200,200 and mouseup at 500,500).
   - Verify that the screenshot editor opens in a new tab.

5. **Test Whole Page Screenshot**
   - Click the Signal widget screenshot dropdown button.
   - Click "Whole Page".
   - Verify that the page scrolls to capture content and the screenshot editor opens in a new tab.
