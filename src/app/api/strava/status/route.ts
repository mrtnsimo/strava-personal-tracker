import { NextResponse } from 'next/server';
import { ensureAccessToken, getAnyConnectedAthleteId, fetchAthleteProfile } from '@/lib/strava';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const athleteId = await getAnyConnectedAthleteId();
    if (!athleteId) {
      return NextResponse.json({ status: 'disconnected' as const });
    }
    try {
      const token = await ensureAccessToken(athleteId);
      const profile = await fetchAthleteProfile(token);
      const supabase = getSupabaseAdmin();
      // Last sync: prefer tokens.updated_at; fallback to latest activity updated_at
      const [{ data: tokenRow }, { data: actRow }] = await Promise.all([
        supabase.from('strava_tokens').select('updated_at').eq('athlete_id', athleteId).single(),
        supabase.from('activities').select('updated_at').eq('athlete_id', athleteId).order('updated_at', { ascending: false }).limit(1).single(),
      ]);
      const lastSync = tokenRow?.updated_at || actRow?.updated_at || null;
      if (!profile) {
        return NextResponse.json({ status: 'degraded' as const, athleteId, lastSync });
      }
      return NextResponse.json({ status: 'connected' as const, athleteId: profile.id, name: profile.name, lastSync });
    } catch {
      const supabase = getSupabaseAdmin();
      const { data: tokenRow } = await supabase
        .from('strava_tokens')
        .select('updated_at')
        .eq('athlete_id', athleteId)
        .single();
      return NextResponse.json({ status: 'degraded' as const, athleteId, lastSync: tokenRow?.updated_at ?? null });
    }
  } catch (e: unknown) {
    return NextResponse.json({ status: 'error', error: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}



