import { getPrettyTime } from '../src/utils/getPrettyTime';

describe('getPrettyTime()', () => {
    it('changes 0 ms to 00:00', () => {
        expect(getPrettyTime(0)).toBe('00:00');
    });

    it('changes 1000 ms to 00:01', () => {
        expect(getPrettyTime(1000)).toBe('00:01');
    });

    it('changes 59499 ms to 00:59', () => {
        expect(getPrettyTime(59499)).toBe('00:59');
    });

    it('changes 59500 ms to 01:00', () => {
        expect(getPrettyTime(59500)).toBe('01:00');
    });
});
