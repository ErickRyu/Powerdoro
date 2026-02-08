import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../ipc/channels';

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
