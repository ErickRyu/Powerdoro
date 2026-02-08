// Mock electron-store before importing the module
const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
  }));
});

import { getSettings, saveSettings, getRetrospectDir } from '../src/settings/store';
import { DEFAULT_SETTINGS } from '../src/settings/types';
import * as path from 'path';
import * as os from 'os';

describe('settings store', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
  });

  describe('getSettings', () => {
    it('should return all settings from the store', () => {
      mockGet
        .mockReturnValueOnce(DEFAULT_SETTINGS.hotkey)
        .mockReturnValueOnce(DEFAULT_SETTINGS.autoLaunch)
        .mockReturnValueOnce(DEFAULT_SETTINGS.timerPresets)
        .mockReturnValueOnce(DEFAULT_SETTINGS.retrospectDir);

      const settings = getSettings();
      expect(settings.hotkey).toBe('CommandOrControl+Shift+P');
      expect(settings.autoLaunch).toBe(true);
      expect(settings.timerPresets).toEqual([25, 50, 90]);
      expect(settings.retrospectDir).toBe('');
    });
  });

  describe('saveSettings', () => {
    it('should save only provided partial settings', () => {
      mockGet
        .mockReturnValueOnce('CommandOrControl+Shift+P')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([25, 50, 90])
        .mockReturnValueOnce('');

      saveSettings({ autoLaunch: false });
      expect(mockSet).toHaveBeenCalledWith('autoLaunch', false);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it('should save hotkey when provided', () => {
      mockGet
        .mockReturnValueOnce('CommandOrControl+Shift+X')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce([25, 50, 90])
        .mockReturnValueOnce('');

      saveSettings({ hotkey: 'CommandOrControl+Shift+X' });
      expect(mockSet).toHaveBeenCalledWith('hotkey', 'CommandOrControl+Shift+X');
    });

    it('should save timerPresets when provided', () => {
      mockGet
        .mockReturnValueOnce('CommandOrControl+Shift+P')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce([10, 20, 30])
        .mockReturnValueOnce('');

      saveSettings({ timerPresets: [10, 20, 30] });
      expect(mockSet).toHaveBeenCalledWith('timerPresets', [10, 20, 30]);
    });

    it('should save retrospectDir when provided', () => {
      mockGet
        .mockReturnValueOnce('CommandOrControl+Shift+P')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce([25, 50, 90])
        .mockReturnValueOnce('/custom/path');

      saveSettings({ retrospectDir: '/custom/path' });
      expect(mockSet).toHaveBeenCalledWith('retrospectDir', '/custom/path');
    });
  });

  describe('getRetrospectDir', () => {
    it('should return custom directory when set', () => {
      mockGet.mockReturnValueOnce('/custom/retrospect');

      const dir = getRetrospectDir();
      expect(dir).toBe('/custom/retrospect');
    });

    it('should return default path when retrospectDir is empty', () => {
      mockGet.mockReturnValueOnce('');

      const dir = getRetrospectDir();
      expect(dir).toBe(path.join(os.homedir(), 'Desktop', 'retrospect'));
    });
  });
});
