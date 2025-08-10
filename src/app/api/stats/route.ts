import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type Period = 'last7' | 'month' | 'ytd';

function getDateRange(period: Period) {
  const now = new Date();
  const end = now;
  if (period === 'last7') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end };
  }
  // ytd
  const start = new Date(now.getFullYear(), 0, 1);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const athleteId = Number(url.searchParams.get('athleteId'));
  if (!athleteId) return NextResponse.json({ error: 'athleteId required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  async function sumBySport(period: Period) {
    const { start, end } = getDateRange(period);
    const { data, error } = await supabase
      .from('activities')
      .select('sport_type, distance_m')
      .eq('athlete_id', athleteId)
      .gte('start_date', start.toISOString())
      .lte('start_date', end.toISOString());
    if (error) throw error;
    const rows = (data ?? []) as { sport_type: string; distance_m: number | null }[];
    const map: Record<string, number> = {};
    for (const row of rows) {
      const key = row.sport_type;
      map[key] = (map[key] ?? 0) + (row.distance_m ?? 0);
    }
    return map;
  }

  try {
    const [last7, month, ytd] = await Promise.all([
      sumBySport('last7'),
      sumBySport('month'),
      sumBySport('ytd'),
    ]);

    return NextResponse.json({ last7, month, ytd });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'stats error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


