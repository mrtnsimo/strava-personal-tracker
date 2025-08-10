import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type Units = 'km' | 'mi';
type PeriodKey = '7d' | '7d_prev' | 'mtd' | 'prev_m' | 'prev2_m' | 'ytd' | 'ytd_prev';

const KM_PER_MI = 1.609344;

function toLocalDate(date: Date, tz: string): Date {
  const iso = date.toLocaleString('en-CA', { timeZone: tz, hour12: false });
  return new Date(iso);
}

function startOfLocalDay(date: Date, tz: string): Date {
  const d = new Date(date);
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  return new Date(`${local.year}-${local.month}-${local.day}T00:00:00`);
}

function localMidnightTomorrow(tz: string): Date {
  const now = new Date();
  const sod = startOfLocalDay(now, tz);
  sod.setDate(sod.getDate() + 1);
  return sod;
}

function rangeFor(period: PeriodKey, tz: string): { start: Date; end: Date } {
  const end = localMidnightTomorrow(tz); // exclusive
  if (period === '7d') {
    const start = startOfLocalDay(new Date(end), tz);
    start.setDate(start.getDate() - 7);
    return { start, end };
  }
  if (period === '7d_prev') {
    const endPrev = startOfLocalDay(new Date(), tz);
    const startPrev = new Date(endPrev);
    startPrev.setDate(startPrev.getDate() - 7);
    return { start: startPrev, end: endPrev };
  }
  if (period === 'prev_m') {
    const now = new Date();
    const sod = startOfLocalDay(now, tz);
    const start = new Date(sod);
    start.setMonth(start.getMonth() - 1, 1); // first day of previous month
    const endPrev = new Date(sod);
    endPrev.setDate(1); // first day of current month (exclusive end)
    return { start, end: endPrev };
  }
  if (period === 'prev2_m') {
    const now = new Date();
    const sod = startOfLocalDay(now, tz);
    const start = new Date(sod);
    start.setMonth(start.getMonth() - 2, 1);
    const endPrev2 = new Date(sod);
    endPrev2.setMonth(endPrev2.getMonth() - 1, 1);
    return { start, end: endPrev2 };
  }
  if (period === 'mtd') {
    const now = new Date();
    const sod = startOfLocalDay(now, tz);
    const start = new Date(sod);
    start.setDate(1);
    return { start, end };
  }
  const now = new Date();
  const sod = startOfLocalDay(now, tz);
  const start = new Date(sod);
  start.setMonth(0, 1);
  if (period === 'ytd') return { start, end };
  // ytd_prev
  const startPrevYear = new Date(start);
  startPrevYear.setFullYear(startPrevYear.getFullYear() - 1);
  const lenMs = end.getTime() - start.getTime();
  const endPrevYear = new Date(startPrevYear.getTime() + lenMs);
  return { start: startPrevYear, end: endPrevYear };
}

const RUN = new Set(['Run', 'TrailRun', 'VirtualRun']);
const RIDE_BASE = ['Ride', 'VirtualRide', 'GravelRide'];
const E_BIKE = ['EBikeRide'];
const SWIM = new Set(['Swim']);

function inCategory(sport: string, includeEbikes: boolean) {
  if (RUN.has(sport)) return 'run' as const;
  if (SWIM.has(sport)) return 'swim' as const;
  if ([...RIDE_BASE, ...(includeEbikes ? E_BIKE : [])].includes(sport)) return 'ride' as const;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const tz = url.searchParams.get('tz') || 'Europe/Bratislava';
    const units = (url.searchParams.get('units') || 'km') as Units;
    const includeEbikes = (url.searchParams.get('include_ebike') || 'false') === 'true';

    async function compute(period: PeriodKey) {
      const { start, end } = rangeFor(period, tz);
      const { data, error } = await supabase
        .from('activities')
        .select('sport_type, distance_m, moving_time_seconds, start_date')
        .gte('start_date', start.toISOString())
        .lt('start_date', end.toISOString());
      if (error) throw error;
      const out: any = { run: { distance: 0, time_s: 0 }, ride: { distance: 0, time_s: 0 }, swim: { distance: 0, time_s: 0 }, total_time_s: 0 };
      const daily: Record<'run' | 'ride' | 'swim', Record<string, number>> = { run: {}, ride: {}, swim: {} };
      for (const row of data ?? []) {
        const cat = inCategory(row.sport_type, includeEbikes);
        if (!cat) continue;
        out[cat].time_s += row.moving_time_seconds ?? 0;
        out[cat].distance += row.distance_m ?? 0;
        const dayKey = new Date(row.start_date).toISOString().slice(0, 10);
        daily[cat][dayKey] = (daily[cat][dayKey] ?? 0) + (row.distance_m ?? 0);
        // accumulate total time by day for sparkline
        out.total_time_s += 0; // keep running total below; per-day time map
      }
      // distances to chosen units
      const factor = units === 'km' ? 1 / 1000 : 1 / 1000 / KM_PER_MI; // m → km/mi
      out.run.distance = Math.round(out.run.distance * factor * 10) / 10;
      out.ride.distance = Math.round(out.ride.distance * factor * 10) / 10;
      out.swim.distance = Math.round(out.swim.distance * factor * 10) / 10;
      out.total_time_s = (out.run.time_s || 0) + (out.ride.time_s || 0) + (out.swim.time_s || 0);
      // sparkline arrays, ordered by day (cumulative)
      const days: string[] = [];
      let cursor = new Date(start);
      while (cursor < end) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
      }
      function toSeries(cat: 'run'|'ride'|'swim') {
        let cum = 0;
        return days.map((d) => {
          cum += (daily[cat][d] ?? 0);
          return Math.round((cum * factor) * 10) / 10;
        });
      }
      // total time cumulative minutes
      const perDayTime: Record<string, number> = {};
      for (const row of data ?? []) {
        const cat = inCategory(row.sport_type, includeEbikes);
        if (!cat) continue;
        const dayKey = new Date(row.start_date).toISOString().slice(0, 10);
        perDayTime[dayKey] = (perDayTime[dayKey] ?? 0) + (row.moving_time_seconds ?? 0);
      }
      let cumTime = 0;
      const totalSeries = days.map((d) => {
        cumTime += perDayTime[d] ?? 0;
        return Math.round(cumTime / 60); // minutes
      });
      out.series = { run: toSeries('run'), ride: toSeries('ride'), swim: toSeries('swim'), totalMin: totalSeries };
      return out;
    }

    const [p7d, p7d_prev, prev_m, prev2_m, mtd, ytd, ytd_prev] = await Promise.all([
      compute('7d'),
      compute('7d_prev'),
      compute('prev_m'),
      compute('prev2_m'),
      compute('mtd'),
      compute('ytd'),
      compute('ytd_prev'),
    ]);
    return NextResponse.json({ units, '7d': p7d, '7d_prev': p7d_prev, prev_m, prev2_m, mtd, ytd, ytd_prev });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'totals error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


