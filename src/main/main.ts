import { app, BrowserWindow, Tray, ipcMain, globalShortcut, screen, Menu, dialog, Notification, nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { updateTray } from './updateTray';
import { getPrettyTime } from '../utils/getPrettyTime';
import * as positioner from 'electron-traywindow-positioner';
import { IPC_CHANNELS } from '../ipc/channels';
import { validateTimerInput, sanitizeRetrospectText, isValidDatePath, validateAccelerator, validateTimerPresets, validateRetrospectDir } from '../ipc/validators';
import { getSettings, saveSettings, getRetrospectDir, getRetrospectDirBookmark, initDefaultRetrospectDir } from '../settings/store';
import { isMAS } from '../utils/platform';
import { AppSettings } from '../settings/types';
import { initDatabase, insertSession, getStats } from '../stats/database';

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}_${m}_${d}`;
}

const ONE_MILLISEC = 1000;

let blockwindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let statsWindow: BrowserWindow | null = null;
let tray: Tray;
let trayWindow: BrowserWindow;
let intervalObj: NodeJS.Timeout | null = null;
let min: number;
let startedTime: string, stopedTime: string;
let currentHotkey: string;
let isQuitting = false;

function isTrustedIpcSender(event: { senderFrame?: { url: string } | null; sender: Electron.WebContents }): boolean {
  const url = event.senderFrame?.url || event.sender.getURL();
  return typeof url === 'string' && url.startsWith('file://');
}

function getExternalDisplayThreshold() {
  const displays = screen.getAllDisplays();
  // Find the primary display (usually the built-in display)
  const primaryDisplay = displays.find(display => display.bounds.x === 0 && display.bounds.y === 0);
  // Find the first external display
  const externalDisplay = displays.find(display => display.bounds.x !== 0 || display.bounds.y !== 0);
  
  // If no external display is found, return primary display coordinates
  if (!externalDisplay) {
    return { x: 0, y: 0 };
  }
  
  return { x: externalDisplay.bounds.x, y: externalDisplay.bounds.y };
}

function createBlockConcentrationWindow() {
  const displayThreshold = getExternalDisplayThreshold();
  const xThreshold = displayThreshold.x;
  const yThreshold = displayThreshold.y;
  const mas = isMAS();
  const setting = {
    x: xThreshold,
    y: yThreshold,
    fullscreen: true,
    frame: false,
    alwaysOnTop: !mas,
    movable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/block-preload.js'),
    },
  };
  blockwindow = new BrowserWindow(setting);
  const blockwindowPath = path.join(__dirname, '../../view/block-window.html');
  blockwindow.loadFile(blockwindowPath);

  if (mas) {
    blockwindow.setAlwaysOnTop(true, 'floating');
    blockwindow.on('close', (e) => {
      if (isQuitting) {
        return;
      }
      const choice = dialog.showMessageBoxSync(blockwindow!, {
        type: 'question',
        buttons: ['Keep Writing', 'Close'],
        defaultId: 0,
        title: 'Close Retrospect?',
        message: 'You haven\'t submitted your retrospect yet. Are you sure you want to close?',
      });
      if (choice === 0) {
        e.preventDefault();
      }
    });
  } else {
    blockwindow.setClosable(false);
  }

  blockwindow.on('closed', function () {
    blockwindow = null;
  });
}

function stopTimer() {
  stopedTime = formatTime(new Date());
  trayWindow.webContents.send(IPC_CHANNELS.TIMER_STOPPED);
  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }
  createBlockConcentrationWindow();

  if (Notification.isSupported()) {
    new Notification({ title: 'Powerdoro', body: 'Timer completed!' }).show();
  }
}

function getMilliSecFor(min: number, sec: number): number {
  let ms = ((min * 60) + sec) * ONE_MILLISEC;
  ms = Math.ceil(ms / ONE_MILLISEC) * ONE_MILLISEC;
  return ms;
}

function startTimer(min: number, sec: number) {
  startedTime = formatTime(new Date());
  let ms = getMilliSecFor(min, sec);
  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }
  updateTray(tray, trayWindow.webContents, ms);
  intervalObj = setInterval(() => {
    ms -= ONE_MILLISEC;
    updateTray(tray, trayWindow.webContents, ms);
    if (ms <= 0) {
      stopTimer();
    }
  }, ONE_MILLISEC);
}

const createTray = () => {
  const defaultIconPath = path.join(__dirname, '../../res/img/appicon.png');
  if (process.platform === 'darwin') {
    const templateIconPath = path.join(__dirname, '../../res/img/trayTemplate.png');
    const templateIcon = nativeImage.createFromPath(templateIconPath);
    if (templateIcon.isEmpty()) {
      tray = new Tray(defaultIconPath);
    } else {
      templateIcon.setTemplateImage(true);
      tray = new Tray(templateIcon);
    }
  } else {
    tray = new Tray(defaultIconPath);
  }
  tray.on('click', function () {
    toggleWindow();
  });
};

const platforms: any = {
  darwin: {
    calcRelativeY: (trayBounds: any) => Math.round(trayBounds.y + trayBounds.height + 3),
    hide: (app: typeof import('electron').app) => app.dock.hide(),
    quit: (app: typeof import('electron').app) => app.quit(),
  },
  win32: {
    calcRelativeY: (trayBounds: any) => trayBounds.y - (3 + 120),
    hide: (app: typeof import('electron').app) => {},
    quit: (app: typeof import('electron').app) => {},
  },
};

const createTrayWindow = () => {
  trayWindow = new BrowserWindow({
    width: 220,
    height: 160,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    movable: false,
    closable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/tray-preload.js'),
    },
  });
  trayWindow.loadURL('file://' + path.join(__dirname, '../../view/tray-window.html'));
  if (!isMAS()) {
    trayWindow.setVisibleOnAllWorkspaces(true);
  }
  trayWindow.on('blur', () => {
    if (!trayWindow.webContents.isDevToolsOpened()) {
      trayWindow.hide();
    }
  });
  trayWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      trayWindow.hide();
      if (process.platform === 'darwin') {
        app.hide();
      }
    }
  });
};

const toggleWindow = () => {
  if (trayWindow.isVisible()) {
    trayWindow.hide();
    if (process.platform === 'darwin') {
      app.hide();
    }
  } else {
    showTrayWindow();
  }
};

const showTrayWindow = () => {
  positioner.position(trayWindow, tray.getBounds());
  trayWindow.show();
  trayWindow.focus();
};

function requestQuitApp(forceAfterMs = 2000): void {
  if (isQuitting) return;
  isQuitting = true;

  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }

  if (!isMAS()) {
    globalShortcut.unregisterAll();
  }

  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.destroy();
    } catch (err) {
      console.error('Failed to destroy window during quit:', err);
    }
  }

  try {
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
    }
  } catch (err) {
    console.error('Failed to destroy tray during quit:', err);
  }

  setTimeout(() => {
    app.exit(0);
  }, forceAfterMs);

  app.quit();
}

function appendRetrospect(retrospect: string): void {
  const retroDirPath = getRetrospectDir();

  // For MAS builds, access security-scoped bookmark if available
  let stopAccess: (() => void) | null = null;
  if (isMAS()) {
    const bookmark = getRetrospectDirBookmark();
    if (bookmark) {
      try {
        stopAccess = app.startAccessingSecurityScopedResource(bookmark) as unknown as () => void;
      } catch (err) {
        console.error('Failed to access security-scoped resource:', err);
      }
    }
  }

  try {
    if (!fs.existsSync(retroDirPath)) {
      fs.mkdirSync(retroDirPath, { recursive: true });
    }

    const dateStr = formatDate(new Date());
    if (!isValidDatePath(dateStr)) {
      console.error('Invalid date path generated:', dateStr);
      return;
    }

    const retroPath = path.join(retroDirPath, `${dateStr}.txt`);
    const ms = getMilliSecFor(min, 0);
    const prettyTime = getPrettyTime(ms);
    const history = `[${startedTime}-${stopedTime}] [${prettyTime}] : ${retrospect}`;
    fs.appendFile(retroPath, history + '\n', (err) => {
      if (err) {
        console.error('Failed to append retrospect file:', err);
      }
    });

    // Save session to SQLite for statistics
    try {
      insertSession({
        date: dateStr,
        startTime: startedTime,
        endTime: stopedTime,
        durationMinutes: min,
        retrospectText: retrospect,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to save session to database:', err);
    }

    if (blockwindow) {
      blockwindow.setClosable(true);
      blockwindow.close();
    }
  } finally {
    if (stopAccess) {
      stopAccess();
    }
  }
}

function registerHotkey(accelerator: string): boolean {
  if (isMAS()) return false;

  // Unregister previous hotkey if set
  if (currentHotkey) {
    try { globalShortcut.unregister(currentHotkey); } catch (_) { /* ignore */ }
  }

  try {
    globalShortcut.register(accelerator, () => {
      toggleWindow();
    });
    if (!globalShortcut.isRegistered(accelerator)) {
      // Registration failed — restore previous
      if (currentHotkey && currentHotkey !== accelerator) {
        try {
          globalShortcut.register(currentHotkey, () => { toggleWindow(); });
        } catch (_) { /* ignore */ }
      }
      return false;
    }
    currentHotkey = accelerator;
    return true;
  } catch (_) {
    // Restore previous on error
    if (currentHotkey && currentHotkey !== accelerator) {
      try {
        globalShortcut.register(currentHotkey, () => { toggleWindow(); });
      } catch (_) { /* ignore */ }
    }
    return false;
  }
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 520,
    frame: true,
    resizable: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/settings-preload.js'),
    },
  });
  settingsWindow.loadFile(path.join(__dirname, '../../view/settings-window.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createStatsWindow() {
  if (statsWindow) {
    statsWindow.focus();
    return;
  }
  statsWindow = new BrowserWindow({
    width: 720,
    height: 640,
    frame: true,
    resizable: true,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/stats-preload.js'),
    },
  });
  statsWindow.loadFile(path.join(__dirname, '../../view/stats-window.html'));
  statsWindow.on('closed', () => {
    statsWindow = null;
  });
}

function broadcastSettings(settings: AppSettings) {
  const allWindows = BrowserWindow.getAllWindows();
  for (const win of allWindows) {
    win.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, settings);
  }
}

function setupContextMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Statistics', click: () => createStatsWindow() },
    { label: 'Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Quit Powerdoro', click: () => requestQuitApp() },
  ]);
  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });
}

ipcMain.on(IPC_CHANNELS.TIMER_START, (_event, arg: unknown) => {
  if (!isTrustedIpcSender(_event)) return;
  const result = validateTimerInput(arg);
  if (!result.valid) {
    console.error('Invalid timer input:', result.error);
    return;
  }
  min = result.value;
  startTimer(result.value, 0);
  trayWindow.hide();
});

ipcMain.on(IPC_CHANNELS.RETROSPECT_SUBMIT, (_event, arg: unknown) => {
  if (!isTrustedIpcSender(_event)) return;
  const result = sanitizeRetrospectText(arg);
  if (!result.valid) {
    console.error('Invalid retrospect text:', result.error);
    return;
  }
  appendRetrospect(result.value);
});

ipcMain.on(IPC_CHANNELS.TIMER_STOP, (event) => {
  if (!isTrustedIpcSender(event)) return;
  stopTimer();
  tray.setTitle('00:00');
});

ipcMain.on(IPC_CHANNELS.APP_EXIT, (event) => {
  if (!isTrustedIpcSender(event)) return;
  requestQuitApp();
});

ipcMain.on(IPC_CHANNELS.SETTINGS_OPEN, (event) => {
  if (!isTrustedIpcSender(event)) return;
  createSettingsWindow();
});

ipcMain.on(IPC_CHANNELS.STATS_OPEN, (event) => {
  if (!isTrustedIpcSender(event)) return;
  createStatsWindow();
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (event) => {
  if (!isTrustedIpcSender(event)) {
    throw new Error('Unauthorized IPC sender');
  }
  return getSettings();
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, partial: Partial<AppSettings>) => {
  if (!isTrustedIpcSender(_event)) {
    throw new Error('Unauthorized IPC sender');
  }
  const prepared: Partial<AppSettings> = {};

  // Validate hotkey
  if (partial.hotkey !== undefined) {
    const result = validateAccelerator(partial.hotkey);
    if (!result.valid) {
      return { error: result.error };
    }
    prepared.hotkey = result.value;
  }

  // Validate presets
  if (partial.timerPresets !== undefined) {
    const result = validateTimerPresets(partial.timerPresets);
    if (!result.valid) {
      return { error: result.error };
    }
    prepared.timerPresets = result.value;
  }

  // Validate retrospect directory
  if (partial.retrospectDir !== undefined) {
    const result = validateRetrospectDir(partial.retrospectDir);
    if (!result.valid) {
      return { error: result.error };
    }
    prepared.retrospectDir = result.value;
  }

  if (partial.autoLaunch !== undefined) {
    prepared.autoLaunch = partial.autoLaunch;
  }

  if (partial.retrospectDirBookmark !== undefined) {
    prepared.retrospectDirBookmark = partial.retrospectDirBookmark;
  }

  // Apply side effects before persistence to avoid saved-but-not-applied drift.
  if (prepared.hotkey !== undefined) {
    const success = registerHotkey(prepared.hotkey);
    if (!success && !isMAS()) {
      return { error: 'Failed to register hotkey. It may conflict with another application.' };
    }
  }

  if (prepared.autoLaunch !== undefined && !isMAS()) {
    app.setLoginItemSettings({ openAtLogin: prepared.autoLaunch });
  }

  const updated = saveSettings(prepared);
  broadcastSettings(updated);
  return updated;
});

ipcMain.handle(IPC_CHANNELS.STATS_GET, (event) => {
  if (!isTrustedIpcSender(event)) {
    throw new Error('Unauthorized IPC sender');
  }
  return getStats();
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_SELECT_DIR, async (event) => {
  if (!isTrustedIpcSender(event)) {
    throw new Error('Unauthorized IPC sender');
  }
  const mas = isMAS();
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    securityScopedBookmarks: mas,
    title: 'Select Retrospect Save Location',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  if (mas && result.bookmarks && result.bookmarks.length > 0) {
    return { path: result.filePaths[0], bookmark: result.bookmarks[0] };
  }
  return { path: result.filePaths[0] };
});

ipcMain.handle(IPC_CHANNELS.IS_MAS, () => {
  return isMAS();
});

platforms[process.platform].hide(app);

app.on('ready', () => {
  // Initialize SQLite database for statistics
  const dbPath = path.join(app.getPath('userData'), 'powerdoro.db');
  initDatabase(dbPath);

  // Initialize sandbox-compatible default retrospect directory
  initDefaultRetrospectDir(path.join(app.getPath('documents'), 'Powerdoro'));

  const settings = getSettings();

  if (!isMAS()) {
    app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
  }

  createTray();
  createTrayWindow();
  setupContextMenu();

  if (!isMAS()) {
    registerHotkey(settings.hotkey);
  }

  // Send initial settings to tray window after it loads
  trayWindow.webContents.on('did-finish-load', () => {
    broadcastSettings(settings);
  });
});

app.on('window-all-closed', function () {
  platforms[process.platform].quit(app);
});

app.on('before-quit', () => {
  isQuitting = true;
  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }
  if (!isMAS()) {
    globalShortcut.unregisterAll();
  }
});

app.on('activate', function () {
  if (blockwindow === null) {
    createBlockConcentrationWindow();
  }
}); 
