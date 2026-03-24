---
trigger: always_on
---

### CHANGELOG.md
- **Header**: Create a new entry under `## [Version] - YYYY-MM-DD`.
- **Categories**: Use the following standard headers:
    - `### Added`: For new capabilities.
    - `### Improved`: For refactors, performance, or UI polish.
    - `### Fixed`: For bug resolutions.
- **Format**: Use bullet points with **Bold Titles** for the specific component or logic changed.

---

## 2. Automation Workflow
When the user says "Task complete" or "I'm done with this feature," execute the following:

1. **Read Current State**: Open `manifest.json` to see the current version.
2. **Determine Change Type**: 
    - Did we add a new UI element to the library? -> **Minor Update**.
    - Did we fix a selector or a layout bug? -> **Patch Update**.
3. **Validation**: Confirm that the version number in the Changelog matches the version number in the Manifest.

Do not change version in manifest.json or add new versions in CHANGELOG.md automatically!
---

## 3. Reference Syntax (CHANGELOG.md)
Entries must follow this exact visual style:

### [1.5] - 2026-03-08
#### Added
- **UI Library Integration**: Automatically creates JSON definitions for new elements in `/ui-library/components`.
- **Full-App Screenshots**: New workflow to capture the entire application state beyond the viewport.

#### Fixed
- **WSL2 Bridge Connectivity**: Corrected the `socat` and `netsh` logic to prevent "Connection Refused" errors.