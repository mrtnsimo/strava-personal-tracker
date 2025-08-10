import { NextRequest, NextResponse } from 'next/server';

const STRAVA_OAUTH_AUTHORIZE = 'https://www.strava.com/oauth/authorize';

export async function GET(req: NextRequest) {
  // Construct the Strava authorize URL and redirect
  // Keeping `req` in signature for Next API route but not using the parsed URL
  const clientId =
    process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID || '';
  let redirectUri =
    process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI || process.env.STRAVA_REDIRECT_URI || '';

  if (!redirectUri) {
    const origin = new URL(req.url).origin;
    redirectUri = `${origin}/api/strava/callback`;
  }

  if (!clientId) {
    return NextResponse.json({ error: 'Missing Strava env var: STRAVA_CLIENT_ID' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  });

  const authorizeUrl = `${STRAVA_OAUTH_AUTHORIZE}?${params.toString()}`;
  return NextResponse.redirect(authorizeUrl);
}


