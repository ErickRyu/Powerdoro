# Mac App Store Sandbox Compatibility Audit Report

**Date:** 2026-02-10
**Auditor:** sandbox-auditor agent
**Project:** Powerdoro (Electron Pomodoro timer)

---

## Executive Summary

The Powerdoro app has **7 critical**, **3 high**, and **3 medium** severity issues that must be resolved before Mac App Store submission. The most impactful issues are: `globalShortcut` API usage (completely blocked in sandbox), `better-sqlite3` native module (requires special rebuild for MAS), and file system access patterns that need sandbox-aware paths.

---

## Issue #1: `globalShortcut` API (BLOCKED in MAS Sandbox)

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Files** | `src/main/main.ts:1, 224-254, 316, 353` |

### Description

The `globalShortcut` API is **completely unavailable** in the Mac App Store sandbox. Apple's sandbox prevents apps from intercepting system-wide keyboard events. The app uses this in multiple places:

- **Line 1:** `import { ..., globalShortcut, ... } from 'electron'`
- **Lines 224-254:** `registerHotkey()` function registers global shortcuts via `globalShortcut.register()`
- **Line 316:** Context menu quit handler calls `globalShortcut.unregisterAll()`
- **Line 353:** `APP_EXIT` IPC handler calls `globalShortcut.unregisterAll()`
- **Line 466:** `app.on('ready')` calls `registerHotkey(settings.hotkey)`

### Recommended Fix

Replace `globalShortcut` with **local keyboard shortcuts** scoped to the app windows:
1. Remove all `globalShortcut` usage
2. Use `Menu.setApplicationMenu()` with `accelerator` properties on menu items (works in sandbox)
3. Or use `BrowserWindow`-level `webContents.on('before-input-event')` for window-scoped shortcuts
4. Update the Settings UI to reflect that hotkeys only work when the app is focused, or remove the hotkey setting entirely
5. Consider using the tray click as the primary activation mechanism (already implemented)

---

## Issue #2: `better-sqlite3` Native Module

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Files** | `src/stats/database.ts:1, 17-19`, `package.json:97` |

### Description

`better-sqlite3` is a native Node.js addon compiled with `node-gyp`. For MAS builds:
1. The module must be rebuilt against the **Electron MAS target** (not regular Electron)
2. Native modules in MAS apps must be **codesigned** with the correct entitlements
3. The module uses `mmap` and file I/O which work within the sandbox **as long as** the database path is inside the app's sandbox container (which it is - `app.getPath('userData')`)

### Current DB Path (OK)

```typescript
// src/main/main.ts:453
const dbPath = path.join(app.getPath('userData'), 'powerdoro.db');
```

This path resolves to `~/Library/Application Support/Powerdoro/` which is inside the sandbox container.

### Recommended Fix

1. Add a separate `rebuild:mas` script for MAS-targeted electron-rebuild:
   ```json
   "rebuild:mas": "npx electron-rebuild -f -w better-sqlite3 --arch=universal"
   ```
2. Ensure `electron-builder` is configured to codesign native modules (it does this by default with proper provisioning profiles)
3. Test the WAL journal mode (`database.ts:19`) - it should work fine in sandbox since it only creates files in the same directory as the DB

---

## Issue #3: `app.setLoginItemSettings` (Different API for MAS)

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Files** | `src/main/main.ts:420, 461` |

### Description

`app.setLoginItemSettings({ openAtLogin: true })` uses the **Login Items** API which works differently for MAS apps:
- **Non-MAS:** Uses `LSSharedFileList` or `SMLoginItemSetEnabled` (works fine)
- **MAS (sandbox):** Requires a **Login Helper app** bundled inside the main app, registered via `SMLoginItemSetEnabled` with a helper bundle ID

Without a Login Helper, `setLoginItemSettings` will **silently fail** in the MAS sandbox.

### Current Usage

```typescript
// src/main/main.ts:420
app.setLoginItemSettings({ openAtLogin: prepared.autoLaunch });

// src/main/main.ts:461
app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
```

### Recommended Fix

**Option A (Recommended):** Conditionally disable auto-launch in MAS builds:
```typescript
if (!process.mas) {
  app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
}
```
Hide the "Auto Launch" setting in the Settings UI when running as MAS build.

**Option B:** Implement a proper Login Helper app using `electron-builder`'s `mas.loginHelper` support. This is complex and may not be worth the effort.

---

## Issue #4: `dialog.showOpenDialog` - Security-Scoped Bookmarks

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Files** | `src/main/main.ts:435-447` |

### Description

The settings window allows users to select a custom retrospect directory using `dialog.showOpenDialog()`. In the sandbox:
- The dialog itself works fine (users can pick directories)
- However, access to the selected directory is **temporary** - it expires when the app restarts
- For **persistent access**, you need **security-scoped bookmarks**

### Current Usage

```typescript
const result = await dialog.showOpenDialog({
  properties: ['openDirectory'],
  title: 'Select Retrospect Save Location',
});
```

### Recommended Fix

1. Add `securityScopedBookmarks: true` to the dialog options:
   ```typescript
   const result = await dialog.showOpenDialog({
     properties: ['openDirectory'],
     securityScopedBookmarks: true,
     title: 'Select Retrospect Save Location',
   });
   ```
2. Store the returned bookmark data (`result.bookmarks[0]`) alongside the path in settings
3. Before accessing the directory, resolve the bookmark via `app.startAccessingSecurityScopedResource(bookmark)` and call the returned stop function when done
4. Add the `com.apple.security.files.bookmarks.app-scope` entitlement to `entitlements.mas.plist`

---

## Issue #5: File System Access - Retrospect Directory

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Files** | `src/main/main.ts:182-222`, `src/settings/store.ts:55-61` |

### Description

The retrospect file writing uses `fs.mkdirSync` and `fs.appendFile` to write text files. The default directory is `app.getPath('documents')` + `/Powerdoro/` which is **inside** the sandbox container (OK). However:

1. **Custom directories** selected via `dialog.showOpenDialog` lose access after restart without security-scoped bookmarks (see Issue #4)
2. The `~/Desktop/retrospect/` path mentioned in CLAUDE.md is **NOT** sandbox-compatible (desktop is outside sandbox container unless explicitly entitled)

### Default Path (OK)

```typescript
// src/main/main.ts:457
initDefaultRetrospectDir(path.join(app.getPath('documents'), 'Powerdoro'));
```

`app.getPath('documents')` in sandbox resolves to `~/Library/Containers/<bundle-id>/Data/Documents/` which is inside the sandbox.

### Recommended Fix

1. Implement security-scoped bookmarks for custom directories (see Issue #4)
2. Consider showing the user-friendly sandbox path in the settings UI
3. Ensure `validateRetrospectDir()` allows sandbox container paths

---

## Issue #6: `electron-store` Storage Path

| Field | Value |
|-------|-------|
| **Severity** | LOW (OK) |
| **Files** | `src/settings/store.ts:1, 28-32` |

### Description

`electron-store` stores data in `app.getPath('userData')` by default, which maps to `~/Library/Application Support/Powerdoro/` (or the sandbox equivalent `~/Library/Containers/<bundle-id>/Data/Library/Application Support/Powerdoro/`).

**This is sandbox-compatible.** No changes needed.

---

## Issue #7: `Tray` API in MAS Sandbox

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Files** | `src/main/main.ts:109-115, 311-321`, `src/main/updateTray.ts:5-8` |

### Description

The `Tray` API is the **core** of this app's UX. In the MAS sandbox:

- `Tray` creation works in sandboxed apps
- `tray.setTitle()` works for displaying timer text in the menu bar
- `tray.popUpContextMenu()` works
- `tray.on('click')` / `tray.on('right-click')` work
- `tray.getBounds()` works

**The Tray API itself is sandbox-compatible.** However, the related `electron-traywindow-positioner` package needs testing since it reads tray bounds to position windows.

### Recommended Fix

Test `electron-traywindow-positioner` in a sandboxed build. It should work since it only uses `tray.getBounds()` and `BrowserWindow.setPosition()`, which are allowed.

---

## Issue #8: `screen` API - Display Detection

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Files** | `src/main/main.ts:1, 41-54` |

### Description

The `screen.getAllDisplays()` API is used in `getExternalDisplayThreshold()` to detect external monitors for the block window positioning. In the MAS sandbox:

- `screen.getAllDisplays()` **works** in the sandbox
- Display bounds information is available
- No additional entitlements needed

**This is sandbox-compatible.** No changes needed.

---

## Issue #9: `BrowserWindow` - `fullscreen: true` and `alwaysOnTop: true`

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Files** | `src/main/main.ts:56-81` |

### Description

The block window uses `fullscreen: true` and `alwaysOnTop: true`:

```typescript
const setting = {
  fullscreen: true,
  frame: false,
  alwaysOnTop: true,
  movable: false,
  // ...
};
```

In the MAS sandbox:
- `fullscreen: true` works but triggers macOS fullscreen animation (enters a new Space)
- `alwaysOnTop: true` **may be restricted** in sandbox - the app may not be able to set its window above all other windows system-wide
- `setClosable(false)` works

The combination is used to create a "forced focus" screen. This blocking behavior may be flagged during App Store review as **hostile UX** (preventing users from using their computer). Apple reviewers may reject apps that prevent dismissing windows.

### Recommended Fix

1. **Consider softening the block behavior:** Instead of truly undismissable fullscreen, use a prominent notification or overlay that can be dismissed (but with friction)
2. If keeping fullscreen block: test `alwaysOnTop` in sandbox - it may only work with `level: 'floating'` (not `'screen-saver'` or `'pop-up-menu'`)
3. `blockwindow.setClosable(false)` (line 77) may trigger App Review rejection. Consider making the window closable but with a confirmation dialog

---

## Issue #10: `app.dock.hide()`

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Files** | `src/main/main.ts:120, 449` |

### Description

```typescript
darwin: {
  hide: (app) => app.dock.hide(),
}
```

`app.dock.hide()` is used to hide the dock icon (tray-only app). This **works in the sandbox** and is commonly used by menu bar apps in the App Store.

However, consider using `LSUIElement` in `Info.plist` instead for a more robust MAS approach:
```xml
<key>LSUIElement</key>
<true/>
```

This can be set via `electron-builder` config:
```json
"mac": {
  "extendInfo": {
    "LSUIElement": true
  }
}
```

### Recommended Fix

Add `LSUIElement` to the build config for a cleaner dock-hiding approach. Keep `app.dock.hide()` as a runtime fallback.

---

## Issue #11: `Notification` API in Renderer

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Files** | `tray-window-renderer.js:101-109` |

### Description

The tray window renderer uses the Web `Notification` API:

```javascript
if (Notification.permission === 'granted') {
  new Notification('Powerdoro', { body: 'Timer completed!' })
}
```

In the MAS sandbox:
- Web `Notification` API works in renderer processes
- However, `Notification.requestPermission()` (line 104) may behave differently - macOS will prompt the user for notification permission
- This is **sandbox-compatible** but needs the notification entitlement or it may silently fail

### Recommended Fix

Consider using Electron's main-process `Notification` API instead for more reliable behavior in sandbox:
```typescript
import { Notification } from 'electron';
new Notification({ title: 'Powerdoro', body: 'Timer completed!' }).show();
```

---

## Issue #12: `setVisibleOnAllWorkspaces(true)`

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Files** | `src/main/main.ts:149` |

### Description

```typescript
trayWindow.setVisibleOnAllWorkspaces(true);
```

This makes the tray window appear on all macOS Spaces/desktops. In the MAS sandbox, `setVisibleOnAllWorkspaces()` **may not work** or may require special entitlements. Apps in the sandbox are generally restricted from modifying their window behavior across workspaces.

### Recommended Fix

1. Test this in a sandboxed build - it may work for menu bar popover windows
2. If it doesn't work, consider removing it - the tray window will just appear on the current Space, which is acceptable UX
3. Wrap in a try-catch or conditional for MAS builds

---

## Issue #13: Build Configuration & Entitlements

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Files** | `package.json:34-48`, `build/entitlements.mas.plist`, `build/entitlements.mas.inherit.plist` |

### Description

The current MAS build config references files that exist but may be incomplete:

**`build/entitlements.mas.plist` (current):**
```xml
<key>com.apple.security.app-sandbox</key>      <!-- Required -->
<key>com.apple.security.files.user-selected.read-write</key>  <!-- For dialog -->
<key>com.apple.security.network.client</key>    <!-- For outbound network -->
```

**Missing entitlements that may be needed:**
- `com.apple.security.files.bookmarks.app-scope` - for security-scoped bookmarks (if implementing persistent directory access)
- No notification entitlement needed (notifications use the standard macOS permission system)

**`build/entitlements.mas.inherit.plist` (current):**
```xml
<key>com.apple.security.app-sandbox</key>
<key>com.apple.security.inherit</key>
```
This is correct for child processes / renderer processes.

**Missing from `package.json` MAS config:**
- No `provisioningProfile` file exists at `build/embedded.provisionprofile` (referenced but absent)
- The `appId` is `com.electron.powerdoro` which needs to match your Apple Developer certificate
- `hardenedRuntime` should NOT be set for MAS builds (it's only set in `mac` section, so this is OK)

### Recommended Fix

1. Obtain a MAS provisioning profile from Apple Developer portal and place at `build/embedded.provisionprofile`
2. Ensure the `appId` matches your Apple Developer App ID
3. Add security-scoped bookmark entitlement if implementing persistent custom directories
4. Consider adding `com.apple.security.files.user-selected.read-only` as a fallback

---

## Issue #14: `notarize.js` - Not Needed for MAS

| Field | Value |
|-------|-------|
| **Severity** | LOW (Info) |
| **Files** | `scripts/notarize.js`, `package.json:64` |

### Description

The `afterSign` hook runs `scripts/notarize.js` which notarizes the app. **Notarization is NOT needed for MAS builds** - Apple handles this during App Store review. The script already checks for `electronPlatformName === 'darwin'`, but MAS builds also use `darwin` as the platform.

### Recommended Fix

Update `notarize.js` to skip MAS builds:
```javascript
if (electronPlatformName !== 'darwin' || context.targets.some(t => t.name === 'mas')) {
  return;
}
```

Or configure `electron-builder` to use `afterSign` only for DMG targets.

---

## Summary Table

| # | Issue | Severity | Status | Action Required |
|---|-------|----------|--------|-----------------|
| 1 | `globalShortcut` API | CRITICAL | Must fix | Replace with local shortcuts or remove |
| 2 | `better-sqlite3` native module | CRITICAL | Must fix | Rebuild for MAS target, ensure codesigning |
| 3 | `app.setLoginItemSettings` | CRITICAL | Must fix | Disable for MAS or implement Login Helper |
| 4 | `dialog.showOpenDialog` bookmarks | HIGH | Must fix | Add security-scoped bookmarks |
| 5 | File system - retrospect dir | HIGH | Partial | Default path OK; custom dirs need bookmarks |
| 6 | `electron-store` path | OK | No action | Already sandbox-compatible |
| 7 | `Tray` API | OK | Test needed | Should work; test positioner package |
| 8 | `screen` API | OK | No action | Already sandbox-compatible |
| 9 | `BrowserWindow` fullscreen+alwaysOnTop | HIGH | Must fix | May cause App Review rejection |
| 10 | `app.dock.hide()` | MEDIUM | Improve | Add `LSUIElement` to Info.plist |
| 11 | `Notification` API | MEDIUM | Improve | Consider main-process Notification |
| 12 | `setVisibleOnAllWorkspaces` | CRITICAL | Must fix | Test in sandbox; may not work |
| 13 | Build config & entitlements | CRITICAL | Must fix | Missing provisioning profile, review entitlements |
| 14 | `notarize.js` for MAS | LOW | Improve | Skip for MAS builds |

---

## Prioritized Fix Order

1. **Remove `globalShortcut`** - completely blocked, app will crash or fail silently
2. **Build configuration** - provisioning profile, entitlements, `appId`
3. **`better-sqlite3` MAS rebuild** - native module must target MAS Electron
4. **`app.setLoginItemSettings`** - conditionally disable for MAS
5. **Security-scoped bookmarks** for `dialog.showOpenDialog` custom directory
6. **`setVisibleOnAllWorkspaces`** - test and conditionally remove
7. **Block window UX** - soften fullscreen blocking for App Review
8. **`LSUIElement`** - add to build config
9. **Notifications** - move to main process
10. **Notarize script** - skip for MAS builds
