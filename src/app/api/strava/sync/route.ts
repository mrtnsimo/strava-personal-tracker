import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureAccessToken } from '@/lib/strava';

const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as { athleteId?: number }));
    const supabase = getSupabaseAdmin();

    let athleteId = Number(body.athleteId);
    if (!athleteId) {
      // Try to infer from stored tokens
      const { data: tokens, error: tErr } = await supabase
        .from('strava_tokens')
        .select('athlete_id')
        .limit(2);
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
      if (!tokens || tokens.length === 0) {
        return NextResponse.json({ error: 'No connected Strava athlete found. Please Connect Strava first.' }, { status: 400 });
      }
      if (tokens.length > 1) {
        return NextResponse.json({ error: 'Multiple athletes connected. Please specify athleteId.' }, { status: 400 });
      }
      athleteId = Number(tokens[0].athlete_id);
    }

    const accessToken = await ensureAccessToken(athleteId);

    // Pull latest activities (first 3 pages)
    const perPage = 100;
    const pages = [1, 2, 3];
    const all: unknown[] = [];
    for (const page of pages) {
      const resp = await fetch(`${STRAVA_ACTIVITIES_URL}?per_page=${perPage}&page=${page}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!resp.ok) break;
      const list = (await resp.json()) as unknown[];
      if (list.length === 0) break;
      all.push(...list);
      if (list.length < perPage) break;
    }

    // Upsert minimal fields
    type StravaActivity = {
      id: number;
      athlete?: { id?: number };
      name?: string;
      sport_type: string;
      distance: number;
      moving_time: number;
      start_date: string;
    };
    const rows = (all as StravaActivity[]).map((a) => ({
      id: a.id,
      athlete_id: a.athlete?.id ?? athleteId,
      name: a.name ?? null,
      sport_type: a.sport_type,
      distance_m: a.distance,
      moving_time_seconds: a.moving_time,
      start_date: a.start_date,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from('activities').upsert(rows, { onConflict: 'id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Touch token updated_at as a last sync signal
    await supabase
      .from('strava_tokens')
      .update({ updated_at: new Date().toISOString() })
      .eq('athlete_id', athleteId);

    return NextResponse.json({ imported: rows.length, athleteId, lastSync: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


