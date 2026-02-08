export interface AppSettings {
  hotkey: string;
  autoLaunch: boolean;
  timerPresets: [number, number, number];
  retrospectDir: string;
}

export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  hotkey: 'CommandOrControl+Shift+P',
  autoLaunch: true,
  timerPresets: [25, 50, 90],
  retrospectDir: '',
};
