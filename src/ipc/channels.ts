/**
 * Typed IPC channel constants for secure main-renderer communication.
 * Replaces the old untyped string-based channel names.
 */
export const IPC_CHANNELS = {
  // Renderer -> Main
  TIMER_START: 'timer:start',           // was 'asynchronous-message'
  TIMER_STOP: 'timer:stop',             // was 'stop-message'
  RETROSPECT_SUBMIT: 'retrospect:submit', // was 'retrospect-message'
  APP_EXIT: 'app:exit',                 // was 'exit-app'
  HEALTH_PING: 'app:health-ping',
  RECOVER_NOW: 'app:recover-now',
  RESTART_SAFE: 'app:restart-safe',

  // Main -> Renderer
  TIMER_UPDATE: 'timer:update',         // was 'time-update'
  TIMER_STOPPED: 'timer:stopped',       // was 'stoped-timer'
  HEALTH_STATE: 'app:health-state',

  // Settings
  SETTINGS_GET: 'settings:get',               // invoke/handle
  SETTINGS_SAVE: 'settings:save',             // invoke/handle
  SETTINGS_OPEN: 'settings:open',             // send/on
  SETTINGS_SELECT_DIR: 'settings:select-dir', // invoke/handle
  SETTINGS_CHANGED: 'settings:changed',       // main -> renderer broadcast

  // Statistics
  STATS_GET: 'stats:get',                     // invoke/handle
  STATS_OPEN: 'stats:open',                   // send/on

  // Platform
  IS_MAS: 'app:is-mas',                       // invoke/handle
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
