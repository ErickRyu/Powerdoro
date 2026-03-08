/**
 * Tests for src/ipc/channels.ts
 *
 * Verifies all IPC channel constants are defined with correct string values,
 * including the recently added STATS_GET and STATS_OPEN channels.
 */
import { IPC_CHANNELS } from '../src/ipc/channels';

describe('IPC_CHANNELS', () => {
  describe('Renderer -> Main channels', () => {
    it('should define TIMER_START', () => {
      expect(IPC_CHANNELS.TIMER_START).toBe('timer:start');
    });

    it('should define TIMER_STOP', () => {
      expect(IPC_CHANNELS.TIMER_STOP).toBe('timer:stop');
    });

    it('should define RETROSPECT_SUBMIT', () => {
      expect(IPC_CHANNELS.RETROSPECT_SUBMIT).toBe('retrospect:submit');
    });

    it('should define APP_EXIT', () => {
      expect(IPC_CHANNELS.APP_EXIT).toBe('app:exit');
    });

    it('should define HEALTH_PING', () => {
      expect(IPC_CHANNELS.HEALTH_PING).toBe('app:health-ping');
    });

    it('should define RECOVER_NOW', () => {
      expect(IPC_CHANNELS.RECOVER_NOW).toBe('app:recover-now');
    });

    it('should define RESTART_SAFE', () => {
      expect(IPC_CHANNELS.RESTART_SAFE).toBe('app:restart-safe');
    });
  });

  describe('Main -> Renderer channels', () => {
    it('should define TIMER_UPDATE', () => {
      expect(IPC_CHANNELS.TIMER_UPDATE).toBe('timer:update');
    });

    it('should define TIMER_STOPPED', () => {
      expect(IPC_CHANNELS.TIMER_STOPPED).toBe('timer:stopped');
    });

    it('should define HEALTH_STATE', () => {
      expect(IPC_CHANNELS.HEALTH_STATE).toBe('app:health-state');
    });
  });

  describe('Settings channels', () => {
    it('should define SETTINGS_GET', () => {
      expect(IPC_CHANNELS.SETTINGS_GET).toBe('settings:get');
    });

    it('should define SETTINGS_SAVE', () => {
      expect(IPC_CHANNELS.SETTINGS_SAVE).toBe('settings:save');
    });

    it('should define SETTINGS_OPEN', () => {
      expect(IPC_CHANNELS.SETTINGS_OPEN).toBe('settings:open');
    });

    it('should define SETTINGS_SELECT_DIR', () => {
      expect(IPC_CHANNELS.SETTINGS_SELECT_DIR).toBe('settings:select-dir');
    });

    it('should define SETTINGS_CHANGED', () => {
      expect(IPC_CHANNELS.SETTINGS_CHANGED).toBe('settings:changed');
    });
  });

  describe('Statistics channels', () => {
    it('should define STATS_GET for invoke/handle pattern', () => {
      expect(IPC_CHANNELS.STATS_GET).toBe('stats:get');
    });

    it('should define STATS_OPEN for send/on pattern', () => {
      expect(IPC_CHANNELS.STATS_OPEN).toBe('stats:open');
    });
  });

  describe('channel uniqueness', () => {
    it('should have no duplicate channel values', () => {
      const values = Object.values(IPC_CHANNELS);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('channel naming convention', () => {
    it('should use colon-separated namespace:action format for all channels', () => {
      const values = Object.values(IPC_CHANNELS);
      for (const value of values) {
        expect(value).toMatch(/^[a-z]+:[a-z][-a-z]*$/);
      }
    });
  });
});
