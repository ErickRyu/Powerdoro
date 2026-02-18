import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  STATS_GET: 'stats:get',
} as const;

contextBridge.exposeInMainWorld('powerdoro', {
  getStats: () => ipcRenderer.invoke(IPC_CHANNELS.STATS_GET),
});
