import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  RETROSPECT_SUBMIT: 'retrospect:submit',
  BLOCK_TIME_UPDATE: 'block:time-update',
} as const;

contextBridge.exposeInMainWorld('powerdoro', {
  sendRetrospect: (text: string) => {
    ipcRenderer.send(IPC_CHANNELS.RETROSPECT_SUBMIT, text);
  },
  onTimeUpdate: (callback: (time: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.BLOCK_TIME_UPDATE, (_event, time: string) => {
      callback(time);
    });
  },
});
