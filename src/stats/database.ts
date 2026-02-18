import Database from 'better-sqlite3';
import {
  SessionRecord,
  PeriodSummary,
  DailyStat,
  HourlyDistribution,
  MonthlyTrend,
  RecentRetrospect,
  StatsData,
} from './types';

let db: Database.Database;

/**
 * Initialize the SQLite database.
 * @param dbPath - Path to DB file, or ':memory:' for tests.
 */
export function initDatabase(dbPath: string): void {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes REAL NOT NULL,
      retrospect_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
  `);
}

export function insertSession(session: SessionRecord): void {
  const stmt = db.prepare(`
    INSERT INTO sessions (date, start_time, end_time, duration_minutes, retrospect_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    session.date,
    session.startTime,
    session.endTime,
    session.durationMinutes,
    session.retrospectText,
    session.createdAt,
  );
}

function getPeriodSummary(whereClause: string, params: string[]): PeriodSummary {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS sessionCount,
      COALESCE(SUM(duration_minutes), 0) AS totalMinutes,
      COALESCE(AVG(duration_minutes), 0) AS averageSessionMinutes
    FROM sessions
    ${whereClause}
  `).get(...params) as { sessionCount: number; totalMinutes: number; averageSessionMinutes: number };

  return {
    sessionCount: row.sessionCount,
    totalMinutes: Math.round(row.totalMinutes * 10) / 10,
    averageSessionMinutes: Math.round(row.averageSessionMinutes * 10) / 10,
  };
}

function formatDateForDB(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}_${m}_${d}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday=0
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDailyStats(): DailyStat[] {
  const days = 30;
  const today = new Date();

  // Query actual data
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffStr = formatDateForDB(cutoff);

  const rows = db.prepare(`
    SELECT date, COUNT(*) AS sessionCount, SUM(duration_minutes) AS totalMinutes
    FROM sessions
    WHERE date >= ?
    GROUP BY date
    ORDER BY date
  `).all(cutoffStr) as { date: string; sessionCount: number; totalMinutes: number }[];

  const dataMap = new Map<string, { sessionCount: number; totalMinutes: number }>();
  for (const row of rows) {
    dataMap.set(row.date, { sessionCount: row.sessionCount, totalMinutes: row.totalMinutes });
  }

  // Fill in missing days with zeros
  const result: DailyStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateForDB(d);
    const data = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      sessionCount: data?.sessionCount ?? 0,
      totalMinutes: data ? Math.round(data.totalMinutes * 10) / 10 : 0,
    });
  }

  return result;
}

function getHourlyDistribution(): HourlyDistribution[] {
  const rows = db.prepare(`
    SELECT
      CAST(SUBSTR(start_time, 1, 2) AS INTEGER) AS hour,
      COUNT(*) AS sessionCount,
      SUM(duration_minutes) AS totalMinutes
    FROM sessions
    GROUP BY hour
    ORDER BY hour
  `).all() as { hour: number; sessionCount: number; totalMinutes: number }[];

  const dataMap = new Map<number, { sessionCount: number; totalMinutes: number }>();
  for (const row of rows) {
    dataMap.set(row.hour, { sessionCount: row.sessionCount, totalMinutes: row.totalMinutes });
  }

  const result: HourlyDistribution[] = [];
  for (let h = 0; h < 24; h++) {
    const data = dataMap.get(h);
    result.push({
      hour: h,
      sessionCount: data?.sessionCount ?? 0,
      totalMinutes: data ? Math.round(data.totalMinutes * 10) / 10 : 0,
    });
  }
  return result;
}

function getMonthlyTrends(): MonthlyTrend[] {
  const rows = db.prepare(`
    SELECT
      SUBSTR(date, 1, 7) AS month,
      COUNT(*) AS sessionCount,
      SUM(duration_minutes) AS totalMinutes
    FROM sessions
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `).all() as { month: string; sessionCount: number; totalMinutes: number }[];

  // YYYY_MM → YYYY-MM for display
  return rows.reverse().map(row => ({
    month: row.month.replace('_', '-'),
    sessionCount: row.sessionCount,
    totalMinutes: Math.round(row.totalMinutes * 10) / 10,
  }));
}

function getRecentRetrospects(limit = 30): RecentRetrospect[] {
  const rows = db.prepare(`
    SELECT
      date,
      start_time AS startTime,
      end_time AS endTime,
      duration_minutes AS durationMinutes,
      retrospect_text AS retrospectText
    FROM sessions
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as RecentRetrospect[];

  return rows.map((row) => ({
    ...row,
    durationMinutes: Math.round(row.durationMinutes * 10) / 10,
  }));
}

function calculateStreaks(): { currentStreak: number; longestStreak: number } {
  const rows = db.prepare(`
    SELECT DISTINCT date FROM sessions ORDER BY date DESC
  `).all() as { date: string }[];

  if (rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Parse YYYY_MM_DD → Date
  const dates = rows.map(r => {
    const [y, m, d] = r.date.split('_').map(Number);
    return new Date(y, m - 1, d);
  });

  // Calculate current streak (from today backwards)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentStreak = 0;
  const checkDate = new Date(today);

  for (const date of dates) {
    date.setHours(0, 0, 0, 0);
    if (date.getTime() === checkDate.getTime()) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (date.getTime() < checkDate.getTime()) {
      break;
    }
  }

  // Calculate longest streak
  // Sort dates ascending for longest streak calculation
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let longestStreak = 0;
  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    if (Math.round(diff) === 1) {
      streak++;
    } else {
      longestStreak = Math.max(longestStreak, streak);
      streak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, streak);

  return { currentStreak, longestStreak };
}

export function getStats(): StatsData {
  const todayStr = formatDateForDB(new Date());
  const mondayStr = formatDateForDB(getMonday(new Date()));

  const today = getPeriodSummary('WHERE date = ?', [todayStr]);
  const thisWeek = getPeriodSummary('WHERE date >= ?', [mondayStr]);
  const dailyStats = getDailyStats();
  const hourlyDistribution = getHourlyDistribution();
  const monthlyTrends = getMonthlyTrends();
  const recentRetrospects = getRecentRetrospects();
  const { currentStreak, longestStreak } = calculateStreaks();

  return {
    today,
    thisWeek,
    dailyStats,
    hourlyDistribution,
    monthlyTrends,
    recentRetrospects,
    currentStreak,
    longestStreak,
  };
}

/** Close DB (for tests) */
export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
