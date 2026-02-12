# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
