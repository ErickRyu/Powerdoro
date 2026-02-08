import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../ipc/channels';

contextBridge.exposeInMainWorld('powerdoro', {
  getStats: () => ipcRenderer.invoke(IPC_CHANNELS.STATS_GET),
});
