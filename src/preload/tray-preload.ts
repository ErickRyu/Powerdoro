import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  TIMER_START: 'timer:start',
  TIMER_STOP: 'timer:stop',
  APP_EXIT: 'app:exit',
  SETTINGS_OPEN: 'settings:open',
  STATS_OPEN: 'stats:open',
  TIMER_UPDATE: 'timer:update',
  TIMER_STOPPED: 'timer:stopped',
  SETTINGS_CHANGED: 'settings:changed',
} as const;

contextBridge.exposeInMainWorld('powerdoro', {
  sendTime: (minutes: number) => {
    ipcRenderer.send(IPC_CHANNELS.TIMER_START, minutes);
  },
  stopTimer: () => {
    ipcRenderer.send(IPC_CHANNELS.TIMER_STOP);
  },
  exitApp: () => {
    ipcRenderer.send(IPC_CHANNELS.APP_EXIT);
  },
  openSettings: () => {
    ipcRenderer.send(IPC_CHANNELS.SETTINGS_OPEN);
  },
  openStats: () => {
    ipcRenderer.send(IPC_CHANNELS.STATS_OPEN);
  },
  onTimeUpdate: (callback: (time: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.TIMER_UPDATE, (_event, time: string) => {
      callback(time);
    });
  },
  onTimerStopped: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.TIMER_STOPPED, () => {
      callback();
    });
  },
  onSettingsChanged: (callback: (settings: Record<string, unknown>) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, (_event, settings) => {
      callback(settings);
    });
  },
});
