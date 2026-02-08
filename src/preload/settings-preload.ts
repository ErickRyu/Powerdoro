import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../ipc/channels';

contextBridge.exposeInMainWorld('powerdoro', {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_DIR),
  onSettingsChanged: (callback: (settings: Record<string, unknown>) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, (_event, settings) => {
      callback(settings);
    });
  },
});
