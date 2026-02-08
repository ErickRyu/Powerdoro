# Security Changes for main.ts

This document describes all changes the refactorer needs to apply in `src/main/main.ts` to complete the security hardening. Each section includes the exact code snippets to use.

## 1. Import Security Modules

Add these imports at the top of `src/main/main.ts`:

```typescript
import { IPC_CHANNELS } from '../ipc/channels';
import { validateTimerInput, sanitizeRetrospectText, isValidDatePath } from '../ipc/validators';
import path from 'path';
```

## 2. BrowserWindow webPreferences Changes

### Tray Window

Replace the old webPreferences in `createTrayWindow()`:

```typescript
// OLD (insecure):
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
}

// NEW (secure):
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, '../preload/tray-preload.js'),
}
```

### Block Window

Replace the old webPreferences in `createBlockConcentrationWindow()`:

```typescript
// OLD (insecure):
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
}

// NEW (secure):
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, '../preload/block-preload.js'),
}
```

**Note:** The preload paths assume compiled JS output from the TypeScript preload scripts. The `__dirname` will be `src/main/` (or compiled `dist/main/`), so the relative path `../preload/` should resolve correctly. Adjust the path if the build output structure differs.

## 3. Update IPC Channel Names

Replace all `ipcMain.on()` handlers to use the new typed channel constants.

### Timer Start Handler

```typescript
// OLD:
ipcMain.on('asynchronous-message', (event, arg) => {
  min = arg;
  startTimer(arg, 0);
  trayWindow.hide();
});

// NEW:
ipcMain.on(IPC_CHANNELS.TIMER_START, (_event, arg: unknown) => {
  const result = validateTimerInput(arg);
  if (!result.valid) {
    console.error('Invalid timer input:', result.error);
    return;
  }
  min = result.value;
  startTimer(result.value, 0);
  trayWindow.hide();
});
```

### Timer Stop Handler

```typescript
// OLD:
ipcMain.on('stop-message', (event, arg) => {
  stopTimer();
  tray.setTitle('00:00');
});

// NEW:
ipcMain.on(IPC_CHANNELS.TIMER_STOP, () => {
  stopTimer();
  tray.setTitle('00:00');
});
```

### Retrospect Handler

```typescript
// OLD:
ipcMain.on('retrospect-message', (event, arg) => {
  appendRetrospect(arg);
});

// NEW:
ipcMain.on(IPC_CHANNELS.RETROSPECT_SUBMIT, (_event, arg: unknown) => {
  const result = sanitizeRetrospectText(arg);
  if (!result.valid) {
    console.error('Invalid retrospect text:', result.error);
    return;
  }
  appendRetrospect(result.value);
});
```

### App Exit Handler

```typescript
// OLD:
ipcMain.on('exit-app', (event, arg) => {
  app.exit();
  globalShortcut.unregisterAll();
});

// NEW:
ipcMain.on(IPC_CHANNELS.APP_EXIT, () => {
  globalShortcut.unregisterAll();
  app.exit();
});
```

## 4. Update Main-to-Renderer Sends

Replace all `webContents.send()` calls to use the new channel constants.

### In updateTray (or wherever time updates are sent):

```typescript
// OLD:
trayWindow.webContents.send('time-update', timeStr);
// NEW:
trayWindow.webContents.send(IPC_CHANNELS.TIMER_UPDATE, timeStr);

// OLD:
blockwindow.webContents.send('block-time-update', timeStr);
// NEW:
blockwindow.webContents.send(IPC_CHANNELS.BLOCK_TIME_UPDATE, timeStr);
```

### In stopTimer():

```typescript
// OLD:
trayWindow.webContents.send('stoped-timer', 'stop');
// NEW:
trayWindow.webContents.send(IPC_CHANNELS.TIMER_STOPPED);
```

## 5. Add Date Path Validation in appendRetrospect

```typescript
// OLD:
var appendRetrospect = function(retrospect) {
  let retroDirPath = path.join(homedir + '/Desktop/retrospect/');
  if (!fs.existsSync(retroDirPath)) {
    fs.mkdir(retroDirPath);
  }
  let retroPath = path.join(retroDirPath + moment().format('YYYY_MM_DD') + '.txt');
  // ...
};

// NEW:
function appendRetrospect(retrospect: string): void {
  const retroDirPath = path.join(homedir, 'Desktop', 'retrospect');
  if (!fs.existsSync(retroDirPath)) {
    fs.mkdirSync(retroDirPath, { recursive: true });
  }

  const dateStr = moment().format('YYYY_MM_DD');
  if (!isValidDatePath(dateStr)) {
    console.error('Invalid date path generated:', dateStr);
    return;
  }

  const retroPath = path.join(retroDirPath, `${dateStr}.txt`);
  // ... rest of function
}
```

**Note:** Also changed `fs.mkdir` (async, missing callback) to `fs.mkdirSync` with `{ recursive: true }` to fix an existing bug where the synchronous existence check is followed by an async mkdir.

## 6. Fix AutoLaunch Hardcoded Path

```typescript
// OLD:
var AutoLauncher = new AutoLaunch({
  name: 'powerdoro',
  path: '/Applications/powerdoro.app',
});

// NEW:
const autoLauncher = new AutoLaunch({
  name: 'powerdoro',
  path: app.getPath('exe'),
});
```

**Note:** `app.getPath('exe')` returns the correct executable path on all platforms, removing the macOS-only hardcoded path.

## 7. Also Update updateTray.js / updateTray.ts

The `updateTray` module sends `'time-update'` and `'block-time-update'` to renderer webContents. It needs to import and use `IPC_CHANNELS` as well. Check the current `updateTray.js` implementation and update the channel name strings.

## Summary of Channel Name Mapping

| Old Channel Name         | New Constant                    | Direction         |
|--------------------------|---------------------------------|-------------------|
| `'asynchronous-message'` | `IPC_CHANNELS.TIMER_START`      | Renderer -> Main  |
| `'stop-message'`         | `IPC_CHANNELS.TIMER_STOP`       | Renderer -> Main  |
| `'retrospect-message'`   | `IPC_CHANNELS.RETROSPECT_SUBMIT`| Renderer -> Main  |
| `'exit-app'`             | `IPC_CHANNELS.APP_EXIT`         | Renderer -> Main  |
| `'time-update'`          | `IPC_CHANNELS.TIMER_UPDATE`     | Main -> Renderer  |
| `'stoped-timer'`         | `IPC_CHANNELS.TIMER_STOPPED`    | Main -> Renderer  |
| `'block-time-update'`    | `IPC_CHANNELS.BLOCK_TIME_UPDATE`| Main -> Renderer  |
