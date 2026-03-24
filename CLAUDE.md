# AI Agent Guidelines for Signal Extension

This document provides guidelines for AI agents (Claude, GitHub Copilot, Cursor, etc.) working on the Signal Extension codebase.

## Table of Contents

- [Core Principles](#core-principles)
- [Backward Compatibility Policy](#backward-compatibility-policy)
- [Breaking Changes Approval Process](#breaking-changes-approval-process)
- [Architecture Understanding](#architecture-understanding)
- [Code Modification Rules](#code-modification-rules)
- [Migration Context](#migration-context)
- [Testing Requirements](#testing-requirements)
- [Communication Guidelines](#communication-guidelines)

---

## Core Principles

### 1. Backward Compatibility First

**CRITICAL RULE: All new features and changes MUST be backward compatible with the current structure.**

This means:
- Existing data formats must continue to work
- Existing Chrome extension message APIs must remain functional
- Existing storage schemas must be supported
- Users should not lose data or functionality after updates
- Old recordings/reports must open in new versions of the viewer

### 2. Test-Driven Development

**CRITICAL RULE: All code must be tested with Vitest before submission.**

This means:
- Write tests for all new features and bug fixes
- Run `npm test` before every commit
- Update tests when modifying existing code
- Build the extension (`npm run build`) and test in Chrome
- All tests must pass before code review

### 3. Progressive Enhancement

When adding features:
- Add new capabilities without breaking existing functionality
- Use feature detection and graceful degradation
- Provide sensible defaults for new optional fields
- Maintain support for legacy data structures

### 4. Data Integrity

User data is sacred:
- Never modify storage schemas without migration paths
- Always test with real user data (old report files)
- Preserve all existing fields when adding new ones
- Document any data format changes

---

## Backward Compatibility Policy

### What Requires Backward Compatibility

#### Storage Schema Changes
```typescript
// ❌ BREAKING - Removes existing field
interface Settings {
  // theme: string;  // DON'T remove existing fields
  darkMode: boolean;
}

// ✅ COMPATIBLE - Adds optional field
interface Settings {
  theme: string;           // Keep existing
  darkMode?: boolean;      // Add optional
}
```

#### Message API Changes
```typescript
// ❌ BREAKING - Changes required parameters
chrome.runtime.sendMessage({
  action: 'start',
  // tabId: number  // DON'T make existing optional params required
});

// ✅ COMPATIBLE - Adds optional parameters
chrome.runtime.sendMessage({
  action: 'start',
  mode?: 'standard' | 'buffer'  // Add as optional
});
```

#### Report Data Format
```typescript
// ❌ BREAKING - Renames existing property
interface ReportData {
  // logs: ConsoleEntry[];  // DON'T rename
  consoleEntries: ConsoleEntry[];
}

// ✅ COMPATIBLE - Adds new property, keeps old
interface ReportData {
  logs: ConsoleEntry[];          // Keep for compatibility
  consoleEntries?: ConsoleEntry[]; // Add as alias/new format
}
```

#### Component Props/Events
```typescript
// ❌ BREAKING - Changes required props
<Widget :isRecording="true" />  // Removed optional props others depend on

// ✅ COMPATIBLE - Adds optional props
<Widget
  :isRecording="true"
  :showMinimized="false"  // Add as optional with default
/>
```

### Migration Strategies

When you MUST change something incompatible:

1. **Versioning**
   ```typescript
   interface ReportData {
     version: string;  // Add version field
     // Use version to handle different formats
   }
   ```

2. **Dual Support**
   ```typescript
   // Support both old and new formats
   function loadReport(data: any) {
     if (data.logs) {
       // Handle old format
       return transformLegacyFormat(data);
     }
     // Handle new format
     return data;
   }
   ```

3. **Gradual Deprecation**
   ```typescript
   // Mark as deprecated but keep working
   interface Settings {
     /** @deprecated Use 'theme' instead */
     darkMode?: boolean;
     theme: 'light' | 'dark';
   }
   ```

---

## Breaking Changes Approval Process

### What Constitutes a Breaking Change?

A breaking change is ANY modification that:
- Removes existing functionality
- Changes existing behavior without opt-in
- Requires users to update their data/settings
- Makes old recordings/reports incompatible
- Changes required parameters in APIs
- Removes or renames storage keys
- Modifies Chrome extension message contracts
- Changes URL parameters or routing

### Approval Workflow

**NO breaking changes without explicit approval from the project maintainer.**

When you identify a potential breaking change:

1. **Stop and Document**
   - Clearly document what would break
   - Explain why the change is necessary
   - Propose alternatives that maintain compatibility

2. **Create a Proposal**
   ```markdown
   ## Breaking Change Proposal

   **What**: [Describe the change]

   **Why**: [Explain the reason]

   **Impact**:
   - What will break
   - Who is affected
   - Migration complexity

   **Alternatives Considered**:
   - [Option 1: Backward compatible approach]
   - [Option 2: Dual support]

   **Migration Path**:
   - [Steps to upgrade]
   - [Automatic vs manual]

   **Rollback Plan**:
   - [How to revert if needed]
   ```

3. **Request Approval**
   - Present the proposal to the maintainer
   - Wait for explicit approval before proceeding
   - Document the approval decision

4. **Implementation Requirements**
   - Provide clear migration documentation
   - Add version detection and warnings
   - Include rollback capability if possible
   - Update CHANGELOG.md with BREAKING CHANGE notice

### Example Approval Request

```
BREAKING CHANGE REQUEST

I need to modify the report data structure to add a new feature.

Current structure:
{
  "userEvents": [...],
  "timestamp": number
}

Proposed structure:
{
  "userEvents": [...],
  "timeline": {
    "startTime": number,
    "events": [...]
  }
}

IMPACT: Old report files won't load without migration

ALTERNATIVE: Keep both formats supported
{
  "userEvents": [...],
  "timestamp": number,  // Keep for old files
  "timeline": {         // Add for new files
    "startTime": number,
    "events": [...]
  }
}

Recommend: Alternative approach maintains compatibility.
Proceeding with dual-format support.
```

---

## Architecture Understanding

Before modifying code, understand:

### Current Architecture

The extension has multiple contexts:
1. **Background Service Worker** (`background.js`) - No DOM, pure Chrome APIs
2. **Content Script** (`content.js`) - Injected into pages, IIFE bundle
3. **Popup** - Vue 3 SFC (fully migrated)
4. **Viewer** - Full page report viewer (needs migration)
5. **Screenshot Editor** - Canvas-based editor (needs migration)

### Communication Flow

```
Popup <---> Background Service Worker <---> Content Script
            |
            v
         Storage (chrome.storage.local)
            |
            v
         Viewer (reads reports)
```

### Migration Status

See [docs/MIGRATION.md](docs/MIGRATION.md) for current status:
- Popup: ✅ Complete
- Content Script: ⚠️ Partial
- Viewer: ❌ Not started
- Screenshot Editor: ❌ Not started
- Background: ❌ Not started

---

## Code Modification Rules

### DO

✅ Write Vitest tests for all new code (components, composables, utilities)
✅ Run `npm test` before committing any changes
✅ Run `npm run build` to verify build succeeds
✅ Test the extension in Chrome after building
✅ Add new optional fields to interfaces
✅ Create new composables for shared logic
✅ Add feature flags for experimental features
✅ Write TypeScript types for all new code
✅ Test with existing data before and after changes
✅ Follow existing code style and patterns
✅ Use Vue 3 Composition API for new components
✅ Document breaking changes in code comments
✅ Add JSDoc comments for public APIs
✅ Follow the migration guide structure

### DON'T

❌ Skip writing tests for new code
❌ Commit code without running `npm test` first
❌ Push code without running `npm run build` successfully
❌ Skip browser testing after building
❌ Remove existing fields from interfaces
❌ Change function signatures without compatibility shims
❌ Modify Chrome extension manifest without testing
❌ Delete code that might be used elsewhere
❌ Rename storage keys without migration
❌ Change message action names
❌ Rewrite large sections without incremental testing
❌ Mix Vue 2 and Vue 3 patterns
❌ Use Vue in background service worker (no DOM!)
❌ Skip the approval process for breaking changes

### File Modification Guidelines

When editing files:

1. **Read Before Writing**
   - Always read the entire file first
   - Understand the context and dependencies
   - Check for TODOs or deprecation notices

2. **Make Minimal Changes**
   - Change only what's necessary
   - Preserve formatting and style
   - Keep git diffs small and focused

3. **Preserve Comments**
   - Keep existing comments (they have context)
   - Add comments explaining your changes
   - Don't remove TODO or FIXME comments without completing them

4. **Test File-Level Compatibility**
   ```typescript
   // Before changing this function:
   function loadReport(data: any) { ... }

   // Test that old code still works:
   const oldFormatData = { /* legacy structure */ };
   loadReport(oldFormatData);  // Must still work!
   ```

---

## Migration Context

The project is mid-migration from vanilla JS to Vue 3 + TypeScript.

### Current Build System

Two Vite configs:
- `vite.config.ts` - Main build (HTML pages with Vue)
- `vite.config.content.ts` - Content script (IIFE bundle)

### What You Can Migrate

Follow the order in [docs/MIGRATION.md](docs/MIGRATION.md):
1. Content Script Widget (complex, IIFE constraints)
2. Screenshot Editor (simple, canvas-based)
3. Background Service Worker (TypeScript only, NO Vue)
4. Viewer (large, incremental approach)

### What You Cannot Break

- Chrome extension manifest structure
- Message passing contracts between contexts
- Storage schemas (settings, reports, temp data)
- Public file paths referenced in manifest
- IIFE bundle format for content script

### Conversion Patterns

See [docs/MIGRATION.md § Conversion Patterns](docs/MIGRATION.md#conversion-patterns) for detailed patterns:
- DOM selection → Template refs
- Event listeners → Vue events
- innerHTML → v-for / computed
- Global state → Composables

---

## Testing Requirements

**CRITICAL: All code changes must be tested using Vitest before submission.**

### Test-Driven Development Workflow

1. **Write/Update Tests First** (when applicable)
   - For new features: Write tests for the expected behavior
   - For bug fixes: Write a test that reproduces the bug
   - For refactoring: Ensure existing tests cover the behavior

2. **Run Tests**
   ```bash
   npm test              # Run all tests once
   npm run test:watch    # Watch mode for development
   ```

3. **Ensure Tests Pass**
   - ALL tests must pass before submitting code
   - Coverage should not decrease
   - Add tests for any new code paths

### Unit Testing with Vitest

The project uses **Vitest** with **@vue/test-utils** for testing Vue components.

**Test Location:** Tests live alongside the code they test:
```
src/
├── popup/
│   ├── Popup.vue
│   └── Popup.test.ts          ✅ Test file
├── viewer/
│   ├── components/
│   │   ├── StorageTab.vue
│   │   └── StorageTab.test.ts  ✅ Test file
```

**Configuration:** See `vitest.config.ts` for test setup:
- Environment: `jsdom` (simulates browser)
- Includes: `src/**/*.test.ts`, `src/**/*.spec.ts`
- Coverage: v8 provider with HTML/JSON/text reports
- Globals: Vitest globals enabled

### When to Add/Update Tests

#### ✅ REQUIRED - Add Tests When:
- Adding a new component or composable
- Adding a new function or utility
- Adding a new feature
- Fixing a bug (write a test that catches it)
- Modifying business logic
- Changing data transformations

#### ✅ REQUIRED - Update Tests When:
- Changing component props or events
- Modifying function signatures
- Updating component behavior
- Refactoring code (tests should still pass or need minimal updates)

#### Example Test Structure:
```typescript
// src/viewer/components/StorageTab.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import StorageTab from './StorageTab.vue';

describe('StorageTab', () => {
  it('renders empty state when no data', () => {
    const wrapper = mount(StorageTab, {
      props: { reportData: null }
    });
    expect(wrapper.text()).toContain('No storage data');
  });

  it('displays localStorage items', () => {
    const wrapper = mount(StorageTab, {
      props: {
        reportData: {
          storage: {
            localStorage: { key: 'value' }
          }
        }
      }
    });
    expect(wrapper.text()).toContain('key');
    expect(wrapper.text()).toContain('value');
  });

  // Test backward compatibility
  it('handles legacy data format', () => {
    const wrapper = mount(StorageTab, {
      props: {
        reportData: {
          // Old format without nested structure
          localStorage: { oldKey: 'oldValue' }
        }
      }
    });
    expect(wrapper.text()).toContain('oldKey');
  });
});
```

### Testing Coverage

Check your test coverage:
```bash
npm test -- --coverage
```

Coverage reports are generated in `coverage/` directory:
- `coverage/index.html` - Browse visual coverage report
- Aim for high coverage on new/modified code

### Before Submitting Code

Follow these steps **in order**:

1. **Run Unit Tests**
   ```bash
   npm test
   ```
   - ✅ All tests must pass
   - ✅ No test failures or errors
   - ✅ Add tests for new code

2. **Build Successfully**
   ```bash
   npm run build
   ```
   - ✅ No TypeScript errors
   - ✅ No build errors
   - ✅ Output in `dist/` directory

3. **Test in Chrome**
   - Load unpacked extension from `dist/`
   - Test the specific feature you modified
   - Test related features that might be affected

4. **Test Backward Compatibility**
   - Load old report files (if viewer changes)
   - Check settings persist (if storage changes)
   - Verify messages work (if API changes)

5. **Test Both Themes**
   - Light theme
   - Dark theme

6. **Check Console**
   - No errors in browser console
   - No errors in extension background page console

### Test Data

When testing, use:
- **Fresh install** - Empty state, default settings
- **Existing data** - Old report files, previous settings
- **Edge cases** - Large reports, missing fields, corrupt data

### Testing Best Practices

#### DO

✅ Write tests for all new components
✅ Write tests for bug fixes (reproduce the bug first)
✅ Test edge cases and error conditions
✅ Test backward compatibility scenarios
✅ Use descriptive test names (`it('should handle empty array')`)
✅ Mock Chrome APIs when needed
✅ Keep tests focused and independent
✅ Test user interactions (clicks, inputs)
✅ Test computed properties and watchers

#### DON'T

❌ Skip tests because "it's simple code"
❌ Write tests that depend on other tests
❌ Test implementation details (test behavior)
❌ Commit code with failing tests
❌ Remove tests without understanding why they exist
❌ Test private methods directly (test through public API)
❌ Use `any` type in tests (be specific)

### Mocking Chrome APIs

When testing code that uses Chrome extension APIs:

```typescript
import { vi } from 'vitest';

// Mock chrome.storage
global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        callback({ theme: 'dark' });
      }),
      set: vi.fn((items, callback) => {
        callback?.();
      })
    }
  }
} as any;
```

### Testing Vue Components

For Vue component tests:

```typescript
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('emits event on button click', async () => {
    const wrapper = mount(MyComponent);
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('submit')).toBeTruthy();
  });

  it('updates when prop changes', async () => {
    const wrapper = mount(MyComponent, {
      props: { count: 0 }
    });
    await wrapper.setProps({ count: 5 });
    expect(wrapper.text()).toContain('5');
  });
});
```

---

## Communication Guidelines

### When Proposing Changes

Be specific:
```
❌ "I'm going to refactor the viewer"
✅ "I'm going to extract the timeline table into TimelineTable.vue
   while keeping the same data structure and behavior"
```

### When Encountering Issues

Report clearly:
```
I found a potential breaking change:
- File: src/viewer/Viewer.vue
- Issue: The report format changed in commit abc123
- Impact: Old report files won't load
- Proposal: Add format detection and migration
```

### When Unsure

Ask before changing:
```
Question: Should I modify the message API to add a new action,
or create a separate optional parameter in the existing action?

Current: { action: 'start' }
Option A: { action: 'startWithMode', mode: 'buffer' }  // New action
Option B: { action: 'start', mode: 'buffer' }  // Optional param
```

---

## Summary Checklist

Before submitting any code:

- [ ] **Tests written/updated** - New tests added or existing tests updated
- [ ] **All Vitest tests pass** - `npm test` runs successfully with no failures
- [ ] **Build succeeds** - `npm run build` completes without errors
- [ ] **Browser testing complete** - Extension tested in Chrome with `dist/` build
- [ ] Changes are backward compatible OR have explicit approval
- [ ] Existing data formats still work
- [ ] Chrome extension APIs unchanged or shimmed
- [ ] Tests pass with old and new data (backward compatibility)
- [ ] Both light and dark themes work
- [ ] No breaking changes to message contracts
- [ ] Documentation updated if needed
- [ ] Migration guide followed (if applicable)
- [ ] Code style matches existing patterns
- [ ] Comments explain why, not just what

---

## Questions?

If you're unsure about:
- Whether a change is breaking
- How to maintain compatibility
- Whether you need approval

**Stop and ask the project maintainer first.**

It's better to ask than to break user data or functionality.

---

**Remember: User data and existing functionality are sacred. When in doubt, maintain compatibility.**