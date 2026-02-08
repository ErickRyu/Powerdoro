import { Tray, WebContents } from 'electron';
import { getPrettyTime } from '../utils/getPrettyTime';
import { IPC_CHANNELS } from '../ipc/channels';

export function updateTray(tray: Tray, webContents: WebContents, ms: number): void {
    const timeString = getPrettyTime(ms);
    tray.setTitle(timeString);
    webContents.send(IPC_CHANNELS.TIMER_UPDATE, timeString);
} 