import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export async function ensureAccessToken(athleteId: number): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: token, error } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('athlete_id', athleteId)
    .single();
  if (error || !token) throw new Error('No token stored for athlete');

  const isExpired = new Date(token.expires_at) <= new Date();
  if (!isExpired) return token.access_token as string;

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing Strava env vars');

  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }),
  });
  if (!resp.ok) throw new Error('Failed to refresh token');
  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  const { error: upsertErr } = await supabase
    .from('strava_tokens')
    .upsert(
      {
        athlete_id: athleteId,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(data.expires_at * 1000).toISOString(),
      },
      { onConflict: 'athlete_id' }
    );
  if (upsertErr) throw upsertErr;
  return data.access_token;
}

export async function getAnyConnectedAthleteId(): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('strava_tokens')
    .select('athlete_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return Number(data[0].athlete_id);
}

export async function fetchAthleteProfile(accessToken: string): Promise<{ id: number; name: string } | null> {
  const resp = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!resp.ok) return null;
  const a = (await resp.json()) as { id: number; firstname?: string; lastname?: string; username?: string };
  const name = a.firstname || a.lastname ? `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim() : a.username || `Athlete ${a.id}`;
  return { id: a.id, name };
}



