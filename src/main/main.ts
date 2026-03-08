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
const HEALTH_PING_INTERVAL_MS = 15000;
const HEALTH_PING_TIMEOUT_MS = 45000;
const TIMER_STATE_PERSIST_INTERVAL_MS = 5000;
const RUNTIME_STATE_FILE = 'runtime-state.json';

type HealthState = 'healthy' | 'degraded' | 'recovering' | 'restart_required';
type RecoveryReason = 'none' | 'heartbeat_timeout' | 'webcontents_unresponsive' | 'render_gone' | 'quit_timeout' | 'manual';

interface ActiveTimerState {
  sessionId: string;
  startedAtEpochMs: number;
  durationSec: number;
  endAtEpochMs: number;
}

interface RuntimeState {
  timer: ActiveTimerState | null;
}

let blockwindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let statsWindow: BrowserWindow | null = null;
let tray: Tray;
let trayWindow: BrowserWindow;
let intervalObj: NodeJS.Timeout | null = null;
let healthMonitorInterval: NodeJS.Timeout | null = null;
let lastTrayHeartbeatAt = 0;
let healthState: HealthState = 'healthy';
let healthReason: RecoveryReason = 'none';
let isRecovering = false;
let runtimeStatePath = '';
let activeTimer: ActiveTimerState | null = null;
let lastTimerStatePersistAt = 0;
let min = 0;
let startedTime = '';
let stopedTime = '';
let currentHotkey: string;
let isQuitting = false;

function getRemainingMsFromActiveTimer(nowEpochMs = Date.now()): number {
  if (!activeTimer) return 0;
  return Math.max(0, activeTimer.endAtEpochMs - nowEpochMs);
}

function sendToTrayWindow(channel: string, payload?: unknown): void {
  if (!trayWindow || trayWindow.isDestroyed()) return;
  try {
    if (payload === undefined) {
      trayWindow.webContents.send(channel);
    } else {
      trayWindow.webContents.send(channel, payload);
    }
  } catch (err) {
    console.error('Failed to send IPC to tray window:', err);
  }
}

function readRuntimeState(): RuntimeState {
  if (!runtimeStatePath) return { timer: null };
  try {
    if (!fs.existsSync(runtimeStatePath)) return { timer: null };
    const raw = fs.readFileSync(runtimeStatePath, 'utf-8');
    const parsed = JSON.parse(raw) as RuntimeState;
    if (!parsed || typeof parsed !== 'object') return { timer: null };
    return { timer: parsed.timer || null };
  } catch (err) {
    console.error('Failed to read runtime state:', err);
    return { timer: null };
  }
}

function writeRuntimeState(state: RuntimeState): void {
  if (!runtimeStatePath) return;
  try {
    fs.writeFileSync(runtimeStatePath, JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.error('Failed to write runtime state:', err);
  }
}

function persistActiveTimerState(): void {
  writeRuntimeState({ timer: activeTimer });
}

function persistActiveTimerStateThrottled(force = false): void {
  const now = Date.now();
  if (!force && now - lastTimerStatePersistAt < TIMER_STATE_PERSIST_INTERVAL_MS) {
    return;
  }
  persistActiveTimerState();
  lastTimerStatePersistAt = now;
}

function clearRuntimeTimerState(): void {
  writeRuntimeState({ timer: null });
}

function isTrustedIpcSender(event: { senderFrame?: { url: string } | null; sender: Electron.WebContents }): boolean {
  const knownWindowSenderIds = new Set<number>();
  for (const win of BrowserWindow.getAllWindows()) {
    knownWindowSenderIds.add(win.webContents.id);
  }
  if (knownWindowSenderIds.has(event.sender.id)) {
    return true;
  }

  const frameUrl = event.senderFrame?.url;
  const senderUrl = event.sender.getURL();
  const url = (frameUrl && frameUrl !== 'about:blank') ? frameUrl : senderUrl;
  const trusted = typeof url === 'string' && (url.startsWith('file://') || url === 'about:blank' || url.length === 0);
  if (!trusted) {
    console.warn('Rejected IPC sender', { frameUrl, senderUrl });
  }
  return trusted;
}

function setHealthState(nextState: HealthState, reason: RecoveryReason): void {
  healthState = nextState;
  healthReason = reason;
  const payload = { state: nextState, reason };
  sendToTrayWindow(IPC_CHANNELS.HEALTH_STATE, payload);
}

function syncTrayRuntimeState(): void {
  if (!trayWindow || trayWindow.isDestroyed()) return;
  if (activeTimer) {
    const remainingMs = getRemainingMsFromActiveTimer();
    updateTray(tray, trayWindow.webContents, remainingMs);
  } else {
    sendToTrayWindow(IPC_CHANNELS.TIMER_STOPPED);
  }
}

async function showRestartRequiredDialog(): Promise<void> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    title: 'Powerdoro needs restart',
    message: 'Powerdoro became unstable.',
    detail: 'Restart now to recover the app. Your running timer will be restored automatically.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  };
  const result = (trayWindow && !trayWindow.isDestroyed())
    ? await dialog.showMessageBox(trayWindow, options)
    : await dialog.showMessageBox(options);
  if (result.response === 0) {
    app.relaunch();
    requestQuitApp(1200);
  }
}

function startHealthMonitor(): void {
  lastTrayHeartbeatAt = Date.now();
  if (healthMonitorInterval) {
    clearInterval(healthMonitorInterval);
  }

  healthMonitorInterval = setInterval(() => {
    if (isQuitting || isRecovering) return;
    if (!trayWindow || trayWindow.isDestroyed()) return;
    if (!trayWindow.isVisible()) {
      lastTrayHeartbeatAt = Date.now();
      if (healthState === 'degraded' && healthReason === 'heartbeat_timeout') {
        setHealthState('healthy', 'none');
      }
      return;
    }
    if (Date.now() - lastTrayHeartbeatAt <= HEALTH_PING_TIMEOUT_MS) return;
    if (healthState === 'degraded' || healthState === 'recovering') return;

    setHealthState('degraded', 'heartbeat_timeout');
    void attemptSoftRecovery('heartbeat_timeout');
  }, HEALTH_PING_INTERVAL_MS);
}

function stopHealthMonitor(): void {
  if (!healthMonitorInterval) return;
  clearInterval(healthMonitorInterval);
  healthMonitorInterval = null;
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
      sandbox: false,
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
  sendToTrayWindow(IPC_CHANNELS.TIMER_STOPPED);
  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }
  activeTimer = null;
  clearRuntimeTimerState();
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
  const durationMs = getMilliSecFor(min, sec);
  const now = Date.now();
  startedTime = formatTime(new Date(now));
  activeTimer = {
    sessionId: `${now}`,
    startedAtEpochMs: now,
    durationSec: Math.floor(durationMs / ONE_MILLISEC),
    endAtEpochMs: now + durationMs,
  };
  persistActiveTimerStateThrottled(true);

  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }

  updateTray(tray, trayWindow.webContents, durationMs);
  intervalObj = setInterval(() => {
    const ms = getRemainingMsFromActiveTimer();
    updateTray(tray, trayWindow.webContents, ms);
    persistActiveTimerStateThrottled();
    if (ms <= 0) {
      stopTimer();
    }
  }, ONE_MILLISEC);
}

function restoreTimerFromState(savedTimer: ActiveTimerState): void {
  const remainingMs = Math.max(0, savedTimer.endAtEpochMs - Date.now());
  if (remainingMs <= 0) {
    clearRuntimeTimerState();
    activeTimer = null;
    tray.setTitle('00:00');
    return;
  }

  min = Math.max(1, Math.ceil(savedTimer.durationSec / 60));
  startedTime = formatTime(new Date(savedTimer.startedAtEpochMs));
  activeTimer = savedTimer;
  persistActiveTimerStateThrottled(true);

  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }

  updateTray(tray, trayWindow.webContents, remainingMs);
  intervalObj = setInterval(() => {
    const ms = getRemainingMsFromActiveTimer();
    updateTray(tray, trayWindow.webContents, ms);
    persistActiveTimerStateThrottled();
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
    width: 360,
    height: 392,
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
      sandbox: false,
      preload: path.join(__dirname, '../preload/tray-preload.js'),
    },
  });
  trayWindow.loadURL('file://' + path.join(__dirname, '../../view/tray-window.html'));
  if (!isMAS()) {
    trayWindow.setVisibleOnAllWorkspaces(true);
  }
  // 120ms delay before hiding: allows click events on tray icon and child elements
  // to complete before the blur-triggered hide fires, preventing UI flicker.
  trayWindow.on('blur', () => {
    setTimeout(() => {
      if (!trayWindow || trayWindow.isDestroyed()) return;
      if (!trayWindow.webContents.isDevToolsOpened() && !trayWindow.webContents.isFocused()) {
        trayWindow.hide();
      }
    }, 120);
  });
  trayWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      trayWindow.hide();
      if (process.platform === 'darwin') {
        app.hide();
      }
    }
  });
  trayWindow.webContents.on('did-finish-load', () => {
    lastTrayHeartbeatAt = Date.now();
    sendToTrayWindow(IPC_CHANNELS.SETTINGS_CHANGED, getSettings());
    setHealthState(healthState, healthReason);
    syncTrayRuntimeState();
  });
  trayWindow.webContents.on('unresponsive', () => {
    if (isQuitting || isRecovering) return;
    setHealthState('degraded', 'webcontents_unresponsive');
    void attemptSoftRecovery('webcontents_unresponsive');
  });
  trayWindow.webContents.on('responsive', () => {
    if (healthState !== 'restart_required') {
      setHealthState('healthy', 'none');
    }
  });
  trayWindow.webContents.on('render-process-gone', () => {
    if (isQuitting || isRecovering) return;
    setHealthState('degraded', 'render_gone');
    void attemptSoftRecovery('render_gone');
  });
};

async function attemptSoftRecovery(reason: RecoveryReason): Promise<void> {
  if (isRecovering || isQuitting) return;
  isRecovering = true;
  setHealthState('recovering', reason);
  try {
    if (trayWindow && !trayWindow.isDestroyed()) {
      trayWindow.destroy();
    }
    createTrayWindow();
    setHealthState('healthy', 'none');
  } catch (err) {
    console.error('Soft recovery failed:', err);
    setHealthState('restart_required', reason);
    await showRestartRequiredDialog();
  } finally {
    isRecovering = false;
  }
}

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
  persistActiveTimerState();

  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }
  stopHealthMonitor();

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
    setHealthState('restart_required', 'quit_timeout');
    app.exit(0);
  }, forceAfterMs);

  app.quit();
}

function restartAppSafely(): void {
  persistActiveTimerState();
  app.relaunch();
  requestQuitApp(1200);
}

function appendRetrospect(retrospect: string): void {
  const retroDirPath = getRetrospectDir();

  // Safely resolve duration: prefer `min`, fall back to activeTimer duration
  const durationMin = min > 0 ? min : (activeTimer ? Math.ceil(activeTimer.durationSec / 60) : 0);

  // Safely resolve timestamps: fall back to current time if unset
  const safeStartedTime = startedTime || formatTime(new Date());
  const safeStopedTime = stopedTime || formatTime(new Date());

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
    const ms = getMilliSecFor(durationMin, 0);
    const prettyTime = getPrettyTime(ms);
    const history = `[${safeStartedTime}-${safeStopedTime}] [${prettyTime}] : ${retrospect}`;
    fs.appendFile(retroPath, history + '\n', (err) => {
      if (err) {
        console.error('Failed to append retrospect file:', err);
        if (Notification.isSupported()) {
          new Notification({ title: 'Powerdoro', body: 'Failed to save retrospect.' }).show();
        }
        return;
      }
    });

    // Save session to SQLite for statistics
    try {
      insertSession({
        date: dateStr,
        startTime: safeStartedTime,
        endTime: safeStopedTime,
        durationMinutes: durationMin,
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
      sandbox: false,
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
      sandbox: false,
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

ipcMain.on(IPC_CHANNELS.HEALTH_PING, (event) => {
  if (!isTrustedIpcSender(event)) return;
  lastTrayHeartbeatAt = Date.now();
  if (healthState !== 'healthy' && !isRecovering) {
    setHealthState('healthy', 'none');
  }
});

ipcMain.on(IPC_CHANNELS.RECOVER_NOW, (event) => {
  if (!isTrustedIpcSender(event)) return;
  void attemptSoftRecovery('manual');
});

ipcMain.on(IPC_CHANNELS.RESTART_SAFE, (event) => {
  if (!isTrustedIpcSender(event)) return;
  restartAppSafely();
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
  runtimeStatePath = path.join(app.getPath('userData'), RUNTIME_STATE_FILE);

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
  startHealthMonitor();

  if (!isMAS()) {
    registerHotkey(settings.hotkey);
  }

  const runtimeState = readRuntimeState();
  if (runtimeState.timer) {
    restoreTimerFromState(runtimeState.timer);
  }
});

app.on('window-all-closed', function () {
  platforms[process.platform].quit(app);
});

app.on('before-quit', () => {
  isQuitting = true;
  persistActiveTimerState();
  stopHealthMonitor();
  if (intervalObj) {
    clearInterval(intervalObj);
    intervalObj = null;
  }
  if (!isMAS()) {
    globalShortcut.unregisterAll();
  }
});

app.on('activate', function () {
  if (trayWindow && !trayWindow.isDestroyed()) {
    showTrayWindow();
  }
});
