import { updateTray } from '../src/main/updateTray';
import { IPC_CHANNELS } from '../src/ipc/channels';

describe('updateTray()', () => {
    it('calls tray.setTitle()', () => {
        let titleValue: string = '';
        const mockTray = { setTitle: (val: string) => { titleValue = val; } };
        const mockWebContents = { send: () => {} };

        updateTray(mockTray as any, mockWebContents as any, 0);

        expect(titleValue).toBe('00:00');
    });

    it('calls webContents.send()', () => {
        let sendArgs: any[] = [];
        const mockTray = { setTitle: () => {} };
        const mockWebContents = { send: (...args: any[]) => { sendArgs = args; } };

        updateTray(mockTray as any, mockWebContents as any, 0);

        expect(sendArgs[0]).toBe(IPC_CHANNELS.TIMER_UPDATE);
        expect(sendArgs[1]).toBe('00:00');
    });
});
