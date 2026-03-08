import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../ipc/channels';

contextBridge.exposeInMainWorld('powerdoro', {
  sendRetrospect: (text: string) => {
    ipcRenderer.send(IPC_CHANNELS.RETROSPECT_SUBMIT, text);
  },
});
