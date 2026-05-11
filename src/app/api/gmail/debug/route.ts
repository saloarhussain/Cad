import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  const s = data?.[0] || {};

  const hasAccessToken = !!s.gmailAccessToken;
  const hasRefreshToken = !!s.gmailRefreshToken;
  const tokenExpiry = s.gmailTokenExpiry;
  const isExpired = tokenExpiry ? Date.now() > tokenExpiry - 300_000 : null;

  let gmailApiStatus = 'not_tested';
  let gmailApiError = null;

  if (hasAccessToken) {
    try {
      const res = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${s.gmailAccessToken}` } }
      );
      const body = await res.json();
      if (res.ok) {
        gmailApiStatus = 'ok';
      } else {
        gmailApiStatus = 'error';
        gmailApiError = body.error?.message || JSON.stringify(body);
      }
    } catch (e: any) {
      gmailApiStatus = 'fetch_failed';
      gmailApiError = e.message;
    }
  }

  return NextResponse.json({
    supabaseError: error?.message ?? null,
    tokens: {
      hasAccessToken,
      hasRefreshToken,
      tokenExpiry,
      isExpired,
      gmailUser: s.gmailUser ?? null,
      clientIdSet: !!s.gmailClientId,
      clientSecretSet: !!s.gmailClientSecret,
    },
    gmailApi: {
      status: gmailApiStatus,
      error: gmailApiError,
    },
  });
}
