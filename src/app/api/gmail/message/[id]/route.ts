import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** Returns a valid access token, refreshing if expired */
async function getValidAccessToken(settings: any, userId: string): Promise<string | null> {
  const { gmailAccessToken, gmailRefreshToken, gmailTokenExpiry, gmailClientId, gmailClientSecret } = settings;
  if (!gmailAccessToken) return null;

  const isExpired = gmailTokenExpiry && Date.now() > gmailTokenExpiry - 300_000;
  if (!isExpired) return gmailAccessToken;
  if (!gmailRefreshToken) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: gmailRefreshToken,
      client_id: gmailClientId,
      client_secret: gmailClientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) return null;

  await supabase.from('settings').upsert({
    user_id: userId,
    gmailAccessToken: tokens.access_token,
    gmailTokenExpiry: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
  }, { onConflict: 'user_id' });
  
  return tokens.access_token;
}

/** Recursively finds and decodes the body from MIME parts */
function extractBody(payload: any): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;

  function decode(data: string): string {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    try {
      return Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }

  function walk(part: any) {
    const mimeType = part.mimeType || '';
    const body = part.body || {};
    if (mimeType === 'text/html' && body.data) {
      html = decode(body.data);
    } else if (mimeType === 'text/plain' && body.data && !html) {
      text = decode(body.data);
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return { html, text };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase.from('settings').select('*').eq('user_id', user.id).limit(1);
  const settings = data?.[0] || {};
  const accessToken = await getValidAccessToken(settings, user.id);

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: res.status });
  }

  const msg = await res.json();
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const { html, text } = extractBody(msg.payload || {});

  // Mark as read
  if ((msg.labelIds || []).includes('UNREAD')) {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });
  }

  return NextResponse.json({
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject') || '(No Subject)',
    date: getHeader('Date'),
    snippet: msg.snippet,
    html,
    text,
    labelIds: msg.labelIds || [],
  });
}
