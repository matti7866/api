// Analytics TypeScript Interfaces
// Created: 2025-10-22

export interface RealTimeComparison {
  today: {
    counts: {
      ticket: number;
      visa: number;
      residence: number;
    };
    start: string;
    end: string;
  };
  pastAverage: {
    counts: {
      ticket: number;
      visa: number;
      residence: number;
    };
    upToNowCounts: {
      ticket: number;
      visa: number;
      residence: number;
    };
    dailyBreakdown: {
      ticket: Record<string, number>;
      visa: Record<string, number>;
      residence: Record<string, number>;
    };
    days: string[];
  };
  percentChanges: {
    ticket: number;
    visa: number;
    residence: number;
  };
  hourlyBreakdown: {
    ticket: Record<string, number>;
    visa: Record<string, number>;
    residence: Record<string, number>;
  };
  hourlyBreakdownPast: {
    ticket: Record<string, number>;
    visa: Record<string, number>;
    residence: Record<string, number>;
  };
  currentHour: number;
}

export interface SalesDataPoint {
  date: string;
  ticket: number;
  visa: number;
  residence: number;
}

export interface PerformanceData {
  period: 'month' | 'year' | 'ytd';
  current: {
    ticket: number;
    visa: number;
    residence: number;
  };
  previous: {
    ticket: number;
    visa: number;
    residence: number;
  };
}

export interface MonthlyCountsData {
  year: number;
  data: {
    ticket: Record<number, number>;
    visa: Record<number, number>;
    residence: Record<number, number>;
  };
}

export interface WeeklyCountsData {
  year: number;
  month: number | null;
  data: {
    ticket: Record<number, number>;
    visa: Record<number, number>;
    residence: Record<number, number>;
  };
}














