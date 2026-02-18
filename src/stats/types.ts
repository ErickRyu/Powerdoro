/** DB에 저장되는 세션 레코드 */
export interface SessionRecord {
  id?: number;
  date: string;              // YYYY_MM_DD
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  durationMinutes: number;
  retrospectText: string;
  createdAt: string;         // ISO 8601
}

/** 기간 요약 */
export interface PeriodSummary {
  sessionCount: number;
  totalMinutes: number;
  averageSessionMinutes: number;
}

/** 일별 통계 */
export interface DailyStat {
  date: string;
  sessionCount: number;
  totalMinutes: number;
}

/** 시간대별 분포 */
export interface HourlyDistribution {
  hour: number;              // 0-23
  sessionCount: number;
  totalMinutes: number;
}

/** 월별 트렌드 */
export interface MonthlyTrend {
  month: string;             // YYYY-MM
  totalMinutes: number;
  sessionCount: number;
}

export interface RecentRetrospect {
  date: string;              // YYYY_MM_DD
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  durationMinutes: number;
  retrospectText: string;
}

/** 통계 응답 (렌더러로 전달) */
export interface StatsData {
  today: PeriodSummary;
  thisWeek: PeriodSummary;
  dailyStats: DailyStat[];
  hourlyDistribution: HourlyDistribution[];
  monthlyTrends: MonthlyTrend[];
  recentRetrospects: RecentRetrospect[];
  currentStreak: number;
  longestStreak: number;
}
