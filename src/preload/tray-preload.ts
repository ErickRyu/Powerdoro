import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../ipc/channels';

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
