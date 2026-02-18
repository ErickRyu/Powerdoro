import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SELECT_DIR: 'settings:select-dir',
  SETTINGS_CHANGED: 'settings:changed',
  IS_MAS: 'app:is-mas',
} as const;

contextBridge.exposeInMainWorld('powerdoro', {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_DIR),
  isMAS: () => ipcRenderer.invoke(IPC_CHANNELS.IS_MAS),
  onSettingsChanged: (callback: (settings: Record<string, unknown>) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, (_event, settings) => {
      callback(settings);
    });
  },
});
