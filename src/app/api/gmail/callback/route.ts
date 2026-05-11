import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cad-dashboard-app.vercel.app';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/auth/login`);
  }

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/inbox?error=gmail_auth_failed`);
  }

  // Read credentials from THIS user's settings
  const { data } = await supabase
    .from('settings')
    .select('"gmailClientId", "gmailClientSecret"')
    .eq('user_id', user.id)
    .limit(1);

  const clientId = data?.[0]?.gmailClientId;
  const clientSecret = data?.[0]?.gmailClientSecret;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${APP_URL}/inbox?error=missing_credentials`);
  }

  const redirectUri = `${APP_URL}/api/gmail/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.access_token) {
    console.error('Token exchange failed:', tokens);
    return NextResponse.redirect(`${APP_URL}/inbox?error=token_exchange_failed`);
  }

  // Fetch Gmail user info to get connected email
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json();

  // Store tokens in user-specific settings
  const { error: upsertError } = await supabase.from('settings').upsert({
    user_id: user.id,
    gmailAccessToken: tokens.access_token,
    gmailRefreshToken: tokens.refresh_token || null,
    gmailTokenExpiry: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : null,
    gmailUser: userInfo.email || undefined,
  }, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('Failed to store tokens:', upsertError);
    return NextResponse.redirect(`${APP_URL}/inbox?error=storage_failed`);
  }

  return NextResponse.redirect(`${APP_URL}/inbox?connected=true`);
}
