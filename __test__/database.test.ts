import { initDatabase, insertSession, getStats, closeDatabase } from '../src/stats/database';
import { SessionRecord } from '../src/stats/types';

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    date: '2026_02_08',
    startTime: '10:00',
    endTime: '10:25',
    durationMinutes: 25,
    retrospectText: 'Test retrospect',
    createdAt: '2026-02-08T10:25:00.000Z',
    ...overrides,
  };
}

describe('Stats Database', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('empty database', () => {
    it('should return all zeros for stats', () => {
      const stats = getStats();
      expect(stats.today.sessionCount).toBe(0);
      expect(stats.today.totalMinutes).toBe(0);
      expect(stats.today.averageSessionMinutes).toBe(0);
      expect(stats.thisWeek.sessionCount).toBe(0);
      expect(stats.dailyStats).toHaveLength(30);
      expect(stats.dailyStats.every(d => d.sessionCount === 0)).toBe(true);
      expect(stats.hourlyDistribution).toHaveLength(24);
      expect(stats.hourlyDistribution.every(h => h.sessionCount === 0)).toBe(true);
      expect(stats.monthlyTrends).toHaveLength(0);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
    });
  });

  describe('insertSession', () => {
    it('should insert a session and retrieve stats', () => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}_${m}_${d}`;

      insertSession(makeSession({ date: dateStr }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(1);
      expect(stats.today.totalMinutes).toBe(25);
      expect(stats.today.averageSessionMinutes).toBe(25);
    });

    it('should handle multiple sessions in a day', () => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}_${m}_${d}`;

      insertSession(makeSession({ date: dateStr, startTime: '09:00', endTime: '09:25', durationMinutes: 25 }));
      insertSession(makeSession({ date: dateStr, startTime: '14:00', endTime: '14:50', durationMinutes: 50 }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(2);
      expect(stats.today.totalMinutes).toBe(75);
      expect(stats.today.averageSessionMinutes).toBe(37.5);
    });
  });

  describe('dailyStats', () => {
    it('should return 30 days with zeros for missing days', () => {
      const stats = getStats();
      expect(stats.dailyStats).toHaveLength(30);
    });

    it('should include data for days with sessions', () => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}_${m}_${d}`;

      insertSession(makeSession({ date: dateStr }));

      const stats = getStats();
      const todayStat = stats.dailyStats[stats.dailyStats.length - 1];
      expect(todayStat.date).toBe(dateStr);
      expect(todayStat.sessionCount).toBe(1);
      expect(todayStat.totalMinutes).toBe(25);
    });
  });

  describe('hourlyDistribution', () => {
    it('should return 24 hours', () => {
      const stats = getStats();
      expect(stats.hourlyDistribution).toHaveLength(24);
      expect(stats.hourlyDistribution[0].hour).toBe(0);
      expect(stats.hourlyDistribution[23].hour).toBe(23);
    });

    it('should count sessions by start hour', () => {
      insertSession(makeSession({ startTime: '09:30' }));
      insertSession(makeSession({ startTime: '09:45' }));
      insertSession(makeSession({ startTime: '14:00' }));

      const stats = getStats();
      expect(stats.hourlyDistribution[9].sessionCount).toBe(2);
      expect(stats.hourlyDistribution[14].sessionCount).toBe(1);
      expect(stats.hourlyDistribution[0].sessionCount).toBe(0);
    });
  });

  describe('monthlyTrends', () => {
    it('should group by month in YYYY-MM format', () => {
      insertSession(makeSession({ date: '2026_01_15' }));
      insertSession(makeSession({ date: '2026_01_20' }));
      insertSession(makeSession({ date: '2026_02_05' }));

      const stats = getStats();
      expect(stats.monthlyTrends.length).toBeGreaterThanOrEqual(2);

      const jan = stats.monthlyTrends.find(m => m.month === '2026-01');
      expect(jan).toBeDefined();
      expect(jan!.sessionCount).toBe(2);
      expect(jan!.totalMinutes).toBe(50);

      const feb = stats.monthlyTrends.find(m => m.month === '2026-02');
      expect(feb).toBeDefined();
      expect(feb!.sessionCount).toBe(1);
    });
  });

  describe('streak calculation', () => {
    it('should calculate current streak from today', () => {
      const today = new Date();
      const dates: string[] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}_${m}_${dd}`);
      }

      for (const date of dates) {
        insertSession(makeSession({ date }));
      }

      const stats = getStats();
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
    });

    it('should break streak on gap', () => {
      const today = new Date();
      // Today and yesterday
      for (let i = 0; i < 2; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        insertSession(makeSession({ date: `${y}_${m}_${dd}` }));
      }
      // Skip a day, then 5 more days
      for (let i = 3; i < 8; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        insertSession(makeSession({ date: `${y}_${m}_${dd}` }));
      }

      const stats = getStats();
      expect(stats.currentStreak).toBe(2);
      expect(stats.longestStreak).toBe(5);
    });

    it('should return 0 streak when no sessions today', () => {
      // Insert session only for 3 days ago
      const d = new Date();
      d.setDate(d.getDate() - 3);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      insertSession(makeSession({ date: `${y}_${m}_${dd}` }));

      const stats = getStats();
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(1);
    });
  });

  describe('thisWeek summary', () => {
    it('should include sessions from Monday of current week', () => {
      // Insert a session for today
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      insertSession(makeSession({ date: `${y}_${m}_${d}`, durationMinutes: 30 }));

      const stats = getStats();
      expect(stats.thisWeek.sessionCount).toBeGreaterThanOrEqual(1);
      expect(stats.thisWeek.totalMinutes).toBeGreaterThanOrEqual(30);
    });
  });
});
