/**
 * Tests for src/stats/database.ts
 *
 * Covers: initDatabase, insertSession, getStats (period summaries, daily stats,
 * hourly distribution, monthly trends, streak calculations), and closeDatabase.
 * Uses in-memory SQLite databases for isolation.
 */
import { initDatabase, insertSession, getStats, closeDatabase } from '../src/stats/database';
import { SessionRecord } from '../src/stats/types';

/** Helper: format a Date as YYYY_MM_DD (matches formatDateForDB in database.ts) */
function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}_${m}_${d}`;
}

/** Helper: return a Date shifted by `offset` days from today (negative = past) */
function daysAgo(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Helper: build a SessionRecord with sensible defaults */
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

/** Today's date string in YYYY_MM_DD format */
function todayStr(): string {
  return toDateStr(new Date());
}

describe('Stats Database', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  // ---------------------------------------------------------------------------
  // Empty database
  // ---------------------------------------------------------------------------
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

    it('should return zero totalMinutes for every daily stat entry', () => {
      const stats = getStats();
      expect(stats.dailyStats.every(d => d.totalMinutes === 0)).toBe(true);
    });

    it('should return zero totalMinutes for every hourly entry', () => {
      const stats = getStats();
      expect(stats.hourlyDistribution.every(h => h.totalMinutes === 0)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // insertSession
  // ---------------------------------------------------------------------------
  describe('insertSession', () => {
    it('should insert a session and retrieve stats', () => {
      insertSession(makeSession({ date: todayStr() }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(1);
      expect(stats.today.totalMinutes).toBe(25);
      expect(stats.today.averageSessionMinutes).toBe(25);
    });

    it('should handle multiple sessions in a day', () => {
      const date = todayStr();
      insertSession(makeSession({ date, startTime: '09:00', endTime: '09:25', durationMinutes: 25 }));
      insertSession(makeSession({ date, startTime: '14:00', endTime: '14:50', durationMinutes: 50 }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(2);
      expect(stats.today.totalMinutes).toBe(75);
      expect(stats.today.averageSessionMinutes).toBe(37.5);
    });

    it('should allow duplicate date values for separate sessions', () => {
      const date = todayStr();
      insertSession(makeSession({ date, startTime: '08:00', durationMinutes: 10 }));
      insertSession(makeSession({ date, startTime: '08:00', durationMinutes: 10 }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(2);
      expect(stats.today.totalMinutes).toBe(20);
    });

    it('should store very long retrospect text', () => {
      const longText = 'A'.repeat(5000);
      insertSession(makeSession({ date: todayStr(), retrospectText: longText }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(1);
    });

    it('should store empty retrospect text', () => {
      insertSession(makeSession({ date: todayStr(), retrospectText: '' }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(1);
    });

    it('should store retrospect text with special characters', () => {
      const specialText = "Line1\nLine2\tTabbed \"quoted\" <html>&amp; symbols' emoji";
      insertSession(makeSession({ date: todayStr(), retrospectText: specialText }));

      const stats = getStats();
      expect(stats.today.sessionCount).toBe(1);
    });

    it('should store fractional duration and round in summaries', () => {
      insertSession(makeSession({ date: todayStr(), durationMinutes: 25.333 }));

      const stats = getStats();
      expect(stats.today.totalMinutes).toBe(25.3);
      expect(stats.today.averageSessionMinutes).toBe(25.3);
    });

    it('should handle very small fractional duration', () => {
      insertSession(makeSession({ date: todayStr(), durationMinutes: 0.1 }));

      const stats = getStats();
      expect(stats.today.totalMinutes).toBe(0.1);
    });

    it('should handle very large duration', () => {
      insertSession(makeSession({ date: todayStr(), durationMinutes: 180 }));

      const stats = getStats();
      expect(stats.today.totalMinutes).toBe(180);
    });
  });

  // ---------------------------------------------------------------------------
  // Period summary rounding
  // ---------------------------------------------------------------------------
  describe('period summary rounding', () => {
    it('should round totalMinutes to one decimal place', () => {
      const date = todayStr();
      // 3 sessions of 10.33 = 30.99 -> rounded to 31.0
      insertSession(makeSession({ date, startTime: '08:00', durationMinutes: 10.33 }));
      insertSession(makeSession({ date, startTime: '09:00', durationMinutes: 10.33 }));
      insertSession(makeSession({ date, startTime: '10:00', durationMinutes: 10.33 }));

      const stats = getStats();
      expect(stats.today.totalMinutes).toBe(31);
    });

    it('should round averageSessionMinutes to one decimal place', () => {
      const date = todayStr();
      // Two sessions: 10 and 11 -> avg = 10.5
      insertSession(makeSession({ date, startTime: '08:00', durationMinutes: 10 }));
      insertSession(makeSession({ date, startTime: '09:00', durationMinutes: 11 }));

      const stats = getStats();
      expect(stats.today.averageSessionMinutes).toBe(10.5);
    });

    it('should round average of 3 uneven durations correctly', () => {
      const date = todayStr();
      // 10 + 10 + 11 = 31, avg = 10.333... -> rounded to 10.3
      insertSession(makeSession({ date, startTime: '08:00', durationMinutes: 10 }));
      insertSession(makeSession({ date, startTime: '09:00', durationMinutes: 10 }));
      insertSession(makeSession({ date, startTime: '10:00', durationMinutes: 11 }));

      const stats = getStats();
      expect(stats.today.averageSessionMinutes).toBe(10.3);
    });
  });

  // ---------------------------------------------------------------------------
  // dailyStats
  // ---------------------------------------------------------------------------
  describe('dailyStats', () => {
    it('should return 30 days with zeros for missing days', () => {
      const stats = getStats();
      expect(stats.dailyStats).toHaveLength(30);
    });

    it('should include data for days with sessions', () => {
      const date = todayStr();
      insertSession(makeSession({ date }));

      const stats = getStats();
      const todayStat = stats.dailyStats[stats.dailyStats.length - 1];
      expect(todayStat.date).toBe(date);
      expect(todayStat.sessionCount).toBe(1);
      expect(todayStat.totalMinutes).toBe(25);
    });

    it('should have the last entry as today and the first as 29 days ago', () => {
      const stats = getStats();
      const last = stats.dailyStats[stats.dailyStats.length - 1];
      const first = stats.dailyStats[0];
      expect(last.date).toBe(todayStr());
      expect(first.date).toBe(toDateStr(daysAgo(29)));
    });

    it('should be sorted in ascending date order', () => {
      insertSession(makeSession({ date: todayStr() }));
      const stats = getStats();
      for (let i = 1; i < stats.dailyStats.length; i++) {
        expect(stats.dailyStats[i].date > stats.dailyStats[i - 1].date).toBe(true);
      }
    });

    it('should exclude sessions older than 30 days', () => {
      const oldDate = daysAgo(31);
      insertSession(makeSession({ date: toDateStr(oldDate) }));

      const stats = getStats();
      expect(stats.dailyStats.every(d => d.sessionCount === 0)).toBe(true);
    });

    it('should include sessions exactly 29 days ago (boundary of 30-day window)', () => {
      const boundaryDate = daysAgo(29);
      insertSession(makeSession({ date: toDateStr(boundaryDate) }));

      const stats = getStats();
      const first = stats.dailyStats[0];
      expect(first.date).toBe(toDateStr(boundaryDate));
      expect(first.sessionCount).toBe(1);
    });

    it('should aggregate multiple sessions on the same day', () => {
      const date = todayStr();
      insertSession(makeSession({ date, startTime: '08:00', durationMinutes: 10 }));
      insertSession(makeSession({ date, startTime: '12:00', durationMinutes: 15 }));
      insertSession(makeSession({ date, startTime: '18:00', durationMinutes: 20 }));

      const stats = getStats();
      const todayStat = stats.dailyStats[stats.dailyStats.length - 1];
      expect(todayStat.sessionCount).toBe(3);
      expect(todayStat.totalMinutes).toBe(45);
    });

    it('should round totalMinutes in daily stats to one decimal', () => {
      const date = todayStr();
      insertSession(makeSession({ date, durationMinutes: 10.33 }));
      insertSession(makeSession({ date, startTime: '11:00', durationMinutes: 10.33 }));

      const stats = getStats();
      const todayStat = stats.dailyStats[stats.dailyStats.length - 1];
      // 10.33 + 10.33 = 20.66 -> round(20.66 * 10) / 10 = 20.7
      expect(todayStat.totalMinutes).toBe(20.7);
    });
  });

  // ---------------------------------------------------------------------------
  // hourlyDistribution
  // ---------------------------------------------------------------------------
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

    it('should correctly bucket midnight sessions at hour 0', () => {
      insertSession(makeSession({ startTime: '00:05', durationMinutes: 25 }));
      insertSession(makeSession({ startTime: '00:30', durationMinutes: 15 }));

      const stats = getStats();
      expect(stats.hourlyDistribution[0].sessionCount).toBe(2);
      expect(stats.hourlyDistribution[0].totalMinutes).toBe(40);
    });

    it('should correctly bucket sessions at hour 23', () => {
      insertSession(makeSession({ startTime: '23:00', durationMinutes: 25 }));
      insertSession(makeSession({ startTime: '23:59', durationMinutes: 5 }));

      const stats = getStats();
      expect(stats.hourlyDistribution[23].sessionCount).toBe(2);
      expect(stats.hourlyDistribution[23].totalMinutes).toBe(30);
    });

    it('should have sequential hours from 0 to 23', () => {
      const stats = getStats();
      stats.hourlyDistribution.forEach((entry, idx) => {
        expect(entry.hour).toBe(idx);
      });
    });

    it('should accumulate totalMinutes across different dates for the same hour', () => {
      insertSession(makeSession({ date: '2026_01_01', startTime: '10:00', durationMinutes: 20 }));
      insertSession(makeSession({ date: '2026_01_02', startTime: '10:30', durationMinutes: 30 }));

      const stats = getStats();
      expect(stats.hourlyDistribution[10].sessionCount).toBe(2);
      expect(stats.hourlyDistribution[10].totalMinutes).toBe(50);
    });

    it('should round totalMinutes in hourly distribution to one decimal', () => {
      insertSession(makeSession({ startTime: '15:00', durationMinutes: 10.33 }));
      insertSession(makeSession({ startTime: '15:30', durationMinutes: 10.33 }));

      const stats = getStats();
      expect(stats.hourlyDistribution[15].totalMinutes).toBe(20.7);
    });
  });

  // ---------------------------------------------------------------------------
  // monthlyTrends
  // ---------------------------------------------------------------------------
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

    it('should convert YYYY_MM underscore format to YYYY-MM dash format', () => {
      insertSession(makeSession({ date: '2025_12_01' }));

      const stats = getStats();
      const dec = stats.monthlyTrends.find(m => m.month === '2025-12');
      expect(dec).toBeDefined();
      // Verify no underscore remains
      stats.monthlyTrends.forEach(m => {
        expect(m.month).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it('should return months in ascending chronological order', () => {
      insertSession(makeSession({ date: '2026_03_01' }));
      insertSession(makeSession({ date: '2025_11_01' }));
      insertSession(makeSession({ date: '2026_01_01' }));

      const stats = getStats();
      for (let i = 1; i < stats.monthlyTrends.length; i++) {
        expect(stats.monthlyTrends[i].month > stats.monthlyTrends[i - 1].month).toBe(true);
      }
    });

    it('should limit results to 12 months', () => {
      // Insert sessions across 14 different months
      for (let i = 0; i < 14; i++) {
        const year = 2025 + Math.floor(i / 12);
        const month = String((i % 12) + 1).padStart(2, '0');
        insertSession(makeSession({ date: `${year}_${month}_15` }));
      }

      const stats = getStats();
      expect(stats.monthlyTrends.length).toBeLessThanOrEqual(12);
    });

    it('should handle sessions spanning year boundaries', () => {
      insertSession(makeSession({ date: '2025_12_31' }));
      insertSession(makeSession({ date: '2026_01_01' }));

      const stats = getStats();
      const dec = stats.monthlyTrends.find(m => m.month === '2025-12');
      const jan = stats.monthlyTrends.find(m => m.month === '2026-01');
      expect(dec).toBeDefined();
      expect(jan).toBeDefined();
      expect(dec!.sessionCount).toBe(1);
      expect(jan!.sessionCount).toBe(1);
    });

    it('should return empty array when no sessions exist', () => {
      const stats = getStats();
      expect(stats.monthlyTrends).toEqual([]);
    });

    it('should round totalMinutes in monthly trends to one decimal', () => {
      insertSession(makeSession({ date: '2026_01_01', durationMinutes: 10.33 }));
      insertSession(makeSession({ date: '2026_01_02', durationMinutes: 10.33 }));
      insertSession(makeSession({ date: '2026_01_03', durationMinutes: 10.33 }));

      const stats = getStats();
      const jan = stats.monthlyTrends.find(m => m.month === '2026-01');
      expect(jan).toBeDefined();
      // 10.33 * 3 = 30.99 -> round(30.99 * 10) / 10 = 31.0
      expect(jan!.totalMinutes).toBe(31);
    });

    it('should handle a single session in a month', () => {
      insertSession(makeSession({ date: '2026_06_15', durationMinutes: 42 }));

      const stats = getStats();
      const june = stats.monthlyTrends.find(m => m.month === '2026-06');
      expect(june).toBeDefined();
      expect(june!.sessionCount).toBe(1);
      expect(june!.totalMinutes).toBe(42);
    });
  });

  // ---------------------------------------------------------------------------
  // Streak calculation
  // ---------------------------------------------------------------------------
  describe('streak calculation', () => {
    it('should calculate current streak from today', () => {
      for (let i = 0; i < 3; i++) {
        insertSession(makeSession({ date: toDateStr(daysAgo(i)) }));
      }

      const stats = getStats();
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
    });

    it('should break streak on gap', () => {
      // Today and yesterday (streak of 2)
      for (let i = 0; i < 2; i++) {
        insertSession(makeSession({ date: toDateStr(daysAgo(i)) }));
      }
      // Skip day 2, then 5 consecutive days (3-7)
      for (let i = 3; i < 8; i++) {
        insertSession(makeSession({ date: toDateStr(daysAgo(i)) }));
      }

      const stats = getStats();
      expect(stats.currentStreak).toBe(2);
      expect(stats.longestStreak).toBe(5);
    });

    it('should return 0 streak when no sessions today', () => {
      insertSession(makeSession({ date: toDateStr(daysAgo(3)) }));

      const stats = getStats();
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(1);
    });

    it('should return streak of 1 for a single session today', () => {
      insertSession(makeSession({ date: todayStr() }));

      const stats = getStats();
      expect(stats.currentStreak).toBe(1);
      expect(stats.longestStreak).toBe(1);
    });

    it('should not double-count multiple sessions on the same day', () => {
      // Insert 3 sessions today -- still only 1 streak day
      insertSession(makeSession({ date: todayStr(), startTime: '08:00' }));
      insertSession(makeSession({ date: todayStr(), startTime: '12:00' }));
      insertSession(makeSession({ date: todayStr(), startTime: '18:00' }));

      const stats = getStats();
      expect(stats.currentStreak).toBe(1);
      expect(stats.longestStreak).toBe(1);
    });

    it('should count consecutive days across a month boundary', () => {
      // Jan 30, 31, Feb 1, 2 (4 consecutive days)
      const dates = ['2026_01_30', '2026_01_31', '2026_02_01', '2026_02_02'];
      for (const date of dates) {
        insertSession(makeSession({ date }));
      }

      const stats = getStats();
      // Current streak depends on whether these dates include today,
      // but longestStreak should be 4.
      expect(stats.longestStreak).toBe(4);
    });

    it('should count consecutive days across a year boundary', () => {
      // Dec 30, 31, Jan 1, 2 (4 consecutive days)
      const dates = ['2025_12_30', '2025_12_31', '2026_01_01', '2026_01_02'];
      for (const date of dates) {
        insertSession(makeSession({ date }));
      }

      const stats = getStats();
      expect(stats.longestStreak).toBe(4);
    });

    it('should count consecutive days across February in a non-leap year', () => {
      // 2025 is not a leap year: Feb has 28 days
      const dates = ['2025_02_27', '2025_02_28', '2025_03_01', '2025_03_02'];
      for (const date of dates) {
        insertSession(makeSession({ date }));
      }

      const stats = getStats();
      expect(stats.longestStreak).toBe(4);
    });

    it('should count consecutive days across February in a leap year', () => {
      // 2024 is a leap year: Feb has 29 days
      const dates = ['2024_02_28', '2024_02_29', '2024_03_01'];
      for (const date of dates) {
        insertSession(makeSession({ date }));
      }

      const stats = getStats();
      expect(stats.longestStreak).toBe(3);
    });

    it('should handle a long streak of 30+ days', () => {
      // Create 35 consecutive days ending today
      for (let i = 0; i < 35; i++) {
        insertSession(makeSession({ date: toDateStr(daysAgo(i)) }));
      }

      const stats = getStats();
      expect(stats.currentStreak).toBe(35);
      expect(stats.longestStreak).toBe(35);
    });

    it('should track longest streak separate from current streak when longest is in the past', () => {
      // Past streak of 10 days (20 days ago through 11 days ago)
      for (let i = 11; i <= 20; i++) {
        insertSession(makeSession({ date: toDateStr(daysAgo(i)) }));
      }
      // Current streak of 3 days (today, yesterday, 2 days ago)
      for (let i = 0; i < 3; i++) {
        insertSession(makeSession({ date: toDateStr(daysAgo(i)) }));
      }

      const stats = getStats();
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(10);
    });

    it('should handle non-consecutive scattered dates', () => {
      // Mon, Wed, Fri - no consecutive pair
      insertSession(makeSession({ date: toDateStr(daysAgo(6)) }));
      insertSession(makeSession({ date: toDateStr(daysAgo(4)) }));
      insertSession(makeSession({ date: toDateStr(daysAgo(2)) }));

      const stats = getStats();
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // thisWeek summary
  // ---------------------------------------------------------------------------
  describe('thisWeek summary', () => {
    it('should include sessions from Monday of current week', () => {
      insertSession(makeSession({ date: todayStr(), durationMinutes: 30 }));

      const stats = getStats();
      expect(stats.thisWeek.sessionCount).toBeGreaterThanOrEqual(1);
      expect(stats.thisWeek.totalMinutes).toBeGreaterThanOrEqual(30);
    });

    it('should exclude sessions from before Monday of current week', () => {
      // Insert a session 14 days ago (definitely before this Monday)
      insertSession(makeSession({ date: toDateStr(daysAgo(14)), durationMinutes: 60 }));

      const stats = getStats();
      // The 14-day-old session should not appear in thisWeek
      // (thisWeek only counts from Monday of the current week)
      // We cannot know the exact count because the test day varies,
      // but we verify the old session did not add to the week total
      // by inserting a known today session and checking the total.
      expect(stats.thisWeek.totalMinutes).toBe(0);
    });

    it('should aggregate all sessions in the current week', () => {
      // Insert session for today
      const date = todayStr();
      insertSession(makeSession({ date, startTime: '08:00', durationMinutes: 20 }));
      insertSession(makeSession({ date, startTime: '12:00', durationMinutes: 30 }));

      const stats = getStats();
      expect(stats.thisWeek.sessionCount).toBe(2);
      expect(stats.thisWeek.totalMinutes).toBe(50);
      expect(stats.thisWeek.averageSessionMinutes).toBe(25);
    });
  });

  // ---------------------------------------------------------------------------
  // getMonday (tested indirectly via thisWeek)
  // ---------------------------------------------------------------------------
  describe('getMonday logic (tested via thisWeek)', () => {
    it('should correctly compute Monday for various days of the week', () => {
      // We test indirectly: insert a session for today's Monday and verify it appears in thisWeek
      const today = new Date();
      const day = today.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - diffToMonday);

      const mondayStr = toDateStr(monday);
      insertSession(makeSession({ date: mondayStr, durationMinutes: 15 }));

      const stats = getStats();
      expect(stats.thisWeek.sessionCount).toBeGreaterThanOrEqual(1);
      expect(stats.thisWeek.totalMinutes).toBeGreaterThanOrEqual(15);
    });

    it('should not include last Sunday in thisWeek summary', () => {
      // Find last Sunday relative to the current week's Monday
      const today = new Date();
      const day = today.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - diffToMonday);

      const lastSunday = new Date(monday);
      lastSunday.setDate(lastSunday.getDate() - 1);

      insertSession(makeSession({ date: toDateStr(lastSunday), durationMinutes: 99 }));

      const stats = getStats();
      // The last-Sunday session should NOT be in thisWeek
      expect(stats.thisWeek.totalMinutes).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Re-initialization
  // ---------------------------------------------------------------------------
  describe('database re-initialization', () => {
    it('should work with a fresh database after close and re-init', () => {
      insertSession(makeSession({ date: todayStr() }));
      closeDatabase();

      initDatabase(':memory:');
      const stats = getStats();
      // New in-memory DB is empty
      expect(stats.today.sessionCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: getStats returns coherent data
  // ---------------------------------------------------------------------------
  describe('getStats integration', () => {
    it('should return coherent data across all fields', () => {
      const date = todayStr();
      insertSession(makeSession({ date, startTime: '10:00', durationMinutes: 25 }));
      insertSession(makeSession({ date, startTime: '14:00', durationMinutes: 50 }));

      const stats = getStats();

      // today and thisWeek should be consistent
      expect(stats.today.sessionCount).toBe(2);
      expect(stats.thisWeek.sessionCount).toBeGreaterThanOrEqual(2);
      expect(stats.thisWeek.totalMinutes).toBeGreaterThanOrEqual(stats.today.totalMinutes);

      // dailyStats last entry should match today summary
      const todayStat = stats.dailyStats[stats.dailyStats.length - 1];
      expect(todayStat.sessionCount).toBe(stats.today.sessionCount);
      expect(todayStat.totalMinutes).toBe(stats.today.totalMinutes);

      // hourlyDistribution should reflect the start hours used
      const hour10 = stats.hourlyDistribution[10];
      const hour14 = stats.hourlyDistribution[14];
      expect(hour10.sessionCount).toBe(1);
      expect(hour14.sessionCount).toBe(1);

      // streaks
      expect(stats.currentStreak).toBe(1);
      expect(stats.longestStreak).toBe(1);
    });

    it('should handle many sessions across different dates, hours, and months', () => {
      // Scatter sessions across multiple dates, hours, and months
      const sessions = [
        { date: '2026_01_10', startTime: '08:00', durationMinutes: 20 },
        { date: '2026_01_11', startTime: '09:00', durationMinutes: 30 },
        { date: '2026_01_12', startTime: '10:00', durationMinutes: 25 },
        { date: '2026_02_01', startTime: '14:00', durationMinutes: 50 },
        { date: '2026_02_02', startTime: '23:00', durationMinutes: 10 },
        { date: todayStr(),    startTime: '00:05', durationMinutes: 15 },
      ];

      for (const s of sessions) {
        insertSession(makeSession(s));
      }

      const stats = getStats();

      // Basic sanity checks
      expect(stats.today.sessionCount).toBe(1);
      expect(stats.today.totalMinutes).toBe(15);
      expect(stats.hourlyDistribution).toHaveLength(24);
      expect(stats.monthlyTrends.length).toBeGreaterThanOrEqual(2);

      // The Jan 10-12 streak should appear in longestStreak
      expect(stats.longestStreak).toBeGreaterThanOrEqual(3);
    });
  });
});
