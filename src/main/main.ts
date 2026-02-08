import { app, BrowserWindow, Tray, ipcMain, globalShortcut, screen, Menu, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { updateTray } from './updateTray';
import { getPrettyTime } from '../utils/getPrettyTime';
import * as positioner from 'electron-traywindow-positioner';
import { IPC_CHANNELS } from '../ipc/channels';
import { validateTimerInput, sanitizeRetrospectText, isValidDatePath, validateAccelerator, validateTimerPresets } from '../ipc/validators';
import { getSettings, saveSettings, getRetrospectDir, initDefaultRetrospectDir } from '../settings/store';
import { AppSettings } from '../settings/types';

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
let tray: Tray;
let trayWindow: BrowserWindow;
let intervalObj: NodeJS.Timeout;
let min: number;
let startedTime: string, stopedTime: string;
let currentHotkey: string;

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
  const setting = {
    x: xThreshold,
    y: yThreshold,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    movable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/block-preload.js'),
    },
  };
  blockwindow = new BrowserWindow(setting);
  const blockwindowPath = path.join(__dirname, '../../view/block-window.html');
  blockwindow.loadFile(blockwindowPath);
  blockwindow.setClosable(false);
  blockwindow.on('closed', function () {
    blockwindow = null;
  });
}

function stopTimer() {
  stopedTime = formatTime(new Date());
  trayWindow.webContents.send(IPC_CHANNELS.TIMER_STOPPED);
  clearTimeout(intervalObj);
  createBlockConcentrationWindow();
}

function getMilliSecFor(min: number, sec: number): number {
  let ms = ((min * 60) + sec) * ONE_MILLISEC;
  ms = Math.ceil(ms / ONE_MILLISEC) * ONE_MILLISEC;
  return ms;
}

function startTimer(min: number, sec: number) {
  startedTime = formatTime(new Date());
  let ms = getMilliSecFor(min, sec);
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
  const iconPath = path.join(__dirname, '../../res/img/appicon.png');
  tray = new Tray(iconPath);
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
      preload: path.join(__dirname, '../preload/tray-preload.js'),
    },
  });
  trayWindow.loadURL('file://' + path.join(__dirname, '../../view/tray-window.html'));
  trayWindow.setVisibleOnAllWorkspaces(true);
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

function appendRetrospect(retrospect: string): void {
  const retroDirPath = getRetrospectDir();
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
      console.log(err);
      throw err;
    }
  });
  if (blockwindow) {
    blockwindow.setClosable(true);
    blockwindow.close();
  }
}

function registerHotkey(accelerator: string): boolean {
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
      preload: path.join(__dirname, '../preload/settings-preload.js'),
    },
  });
  settingsWindow.loadFile(path.join(__dirname, '../../view/settings-window.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
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
    { label: 'Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Quit Powerdoro', click: () => { globalShortcut.unregisterAll(); app.quit(); } },
  ]);
  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });
}

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

ipcMain.on(IPC_CHANNELS.RETROSPECT_SUBMIT, (_event, arg: unknown) => {
  const result = sanitizeRetrospectText(arg);
  if (!result.valid) {
    console.error('Invalid retrospect text:', result.error);
    return;
  }
  appendRetrospect(result.value);
});

ipcMain.on(IPC_CHANNELS.TIMER_STOP, () => {
  stopTimer();
  tray.setTitle('00:00');
});

ipcMain.on(IPC_CHANNELS.APP_EXIT, () => {
  globalShortcut.unregisterAll();
  app.exit();
});

ipcMain.on(IPC_CHANNELS.SETTINGS_OPEN, () => {
  createSettingsWindow();
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
  return getSettings();
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, partial: Partial<AppSettings>) => {
  // Validate hotkey
  if (partial.hotkey !== undefined) {
    const result = validateAccelerator(partial.hotkey);
    if (!result.valid) {
      return { error: result.error };
    }
  }

  // Validate presets
  if (partial.timerPresets !== undefined) {
    const result = validateTimerPresets(partial.timerPresets);
    if (!result.valid) {
      return { error: result.error };
    }
    partial.timerPresets = result.value;
  }

  const updated = saveSettings(partial);

  // Apply side effects
  if (partial.hotkey !== undefined) {
    const success = registerHotkey(partial.hotkey);
    if (!success) {
      return { error: 'Failed to register hotkey. It may conflict with another application.' };
    }
  }

  if (partial.autoLaunch !== undefined) {
    app.setLoginItemSettings({ openAtLogin: partial.autoLaunch });
  }

  broadcastSettings(updated);
  return updated;
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_SELECT_DIR, async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Retrospect Save Location',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

platforms[process.platform].hide(app);

app.on('ready', () => {
  // Initialize sandbox-compatible default retrospect directory
  initDefaultRetrospectDir(path.join(app.getPath('documents'), 'Powerdoro'));

  const settings = getSettings();

  app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });

  createTray();
  createTrayWindow();
  setupContextMenu();
  registerHotkey(settings.hotkey);

  // Send initial settings to tray window after it loads
  trayWindow.webContents.on('did-finish-load', () => {
    broadcastSettings(settings);
  });
});

app.on('window-all-closed', function () {
  platforms[process.platform].quit(app);
});

app.on('activate', function () {
  if (blockwindow === null) {
    createBlockConcentrationWindow();
  }
}); 