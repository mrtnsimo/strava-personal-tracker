import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const STRAVA_OAUTH_TOKEN = 'https://www.strava.com/oauth/token';

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete: { id: number };
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri =
    process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI || process.env.STRAVA_REDIRECT_URI || `${new URL(req.url).origin}/api/strava/callback`;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: 'Missing Strava env vars' }, { status: 500 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const tokenResp = await fetch(STRAVA_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    return NextResponse.json({ error: 'Failed to exchange code', details: text }, { status: 500 });
  }

  const data = (await tokenResp.json()) as StravaTokenResponse;

  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(data.expires_at * 1000);

  const upsertResult = await supabase
    .from('strava_tokens')
    .upsert(
      {
        athlete_id: data.athlete.id,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'athlete_id' }
    )
    .select('*')
    .single();

  if (upsertResult.error) {
    return NextResponse.json({ error: upsertResult.error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/', url.origin));
}


