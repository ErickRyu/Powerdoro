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

  // Main -> Renderer
  TIMER_UPDATE: 'timer:update',         // was 'time-update'
  TIMER_STOPPED: 'timer:stopped',       // was 'stoped-timer'
  BLOCK_TIME_UPDATE: 'block:time-update', // was 'block-time-update'

  // Settings
  SETTINGS_GET: 'settings:get',               // invoke/handle
  SETTINGS_SAVE: 'settings:save',             // invoke/handle
  SETTINGS_OPEN: 'settings:open',             // send/on
  SETTINGS_SELECT_DIR: 'settings:select-dir', // invoke/handle
  SETTINGS_CHANGED: 'settings:changed',       // main -> renderer broadcast
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
