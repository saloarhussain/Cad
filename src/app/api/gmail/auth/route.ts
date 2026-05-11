import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  // Read Client ID from Supabase settings (user entered it in Settings page)
  const { data } = await supabase.from('settings').select('"gmailClientId"').limit(1);
  const clientId = data?.[0]?.gmailClientId;

  if (!clientId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://cad-dashboard-app.vercel.app'}/inbox?error=no_client_id`
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://cad-dashboard-app.vercel.app'}/api/gmail/callback`;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(authUrl.toString());
}
