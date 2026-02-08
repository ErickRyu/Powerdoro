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
});
