import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS } from './types';

let defaultRetrospectDir = '';

const schema = {
  hotkey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.hotkey,
  },
  autoLaunch: {
    type: 'boolean' as const,
    default: DEFAULT_SETTINGS.autoLaunch,
  },
  timerPresets: {
    type: 'array' as const,
    items: { type: 'number' as const, minimum: 1, maximum: 180 },
    minItems: 3,
    maxItems: 3,
    default: DEFAULT_SETTINGS.timerPresets,
  },
  retrospectDir: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.retrospectDir,
  },
};

const store = new Store<AppSettings>({
  name: 'settings',
  schema,
  defaults: DEFAULT_SETTINGS,
});

export function getSettings(): AppSettings {
  return {
    hotkey: store.get('hotkey'),
    autoLaunch: store.get('autoLaunch'),
    timerPresets: store.get('timerPresets'),
    retrospectDir: store.get('retrospectDir'),
  };
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  if (partial.hotkey !== undefined) store.set('hotkey', partial.hotkey);
  if (partial.autoLaunch !== undefined) store.set('autoLaunch', partial.autoLaunch);
  if (partial.timerPresets !== undefined) store.set('timerPresets', partial.timerPresets);
  if (partial.retrospectDir !== undefined) store.set('retrospectDir', partial.retrospectDir);
  return getSettings();
}

export function initDefaultRetrospectDir(dir: string): void {
  defaultRetrospectDir = dir;
}

export function getRetrospectDir(): string {
  const dir = store.get('retrospectDir');
  if (dir && dir.length > 0) {
    return dir;
  }
  return defaultRetrospectDir;
}
