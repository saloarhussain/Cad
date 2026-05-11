import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** Returns a valid access token, refreshing it if expired */
async function getValidAccessToken(settings: any, userId: string): Promise<string | null> {
  const { gmailAccessToken, gmailRefreshToken, gmailTokenExpiry, gmailClientId, gmailClientSecret } = settings;

  if (!gmailAccessToken) return null;

  const isExpired = gmailTokenExpiry && Date.now() > gmailTokenExpiry - 300_000;
  if (!isExpired) return gmailAccessToken;
  if (!gmailRefreshToken || !gmailClientId || !gmailClientSecret) return null;

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

function parseFrom(from: string) {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].replace(/^"|"$/g, '').trim(), email: match[2].trim().toLowerCase() };
  return { name: from.trim(), email: from.trim().toLowerCase() };
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

async function fetchMessages(accessToken: string, query: string, maxResults = 15) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.messages || []).map((m: any) => m.id);
}

async function fetchMessageDetails(accessToken: string, ids: string[]) {
  return Promise.all(
    ids.map(async (id) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return res.ok ? res.json() : null;
    })
  );
}

export async function GET() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Load settings + client list for THIS user
  const [{ data: settingsData }, { data: clientsData }] = await Promise.all([
    supabase.from('settings').select('*').eq('user_id', user.id).limit(1),
    supabase.from('clients').select('email, name, companyName').eq('user_id', user.id),
  ]);

  const settings = settingsData?.[0] || {};
  const accessToken = await getValidAccessToken(settings, user.id);

  if (!accessToken) {
    return NextResponse.json({ connected: false, messages: [] });
  }

  const clients = clientsData || [];
  const clientEmails: string[] = clients
    .map((c: any) => c.email?.trim().toLowerCase())
    .filter(Boolean);

  const clientMap: Record<string, string> = {};
  clients.forEach((c: any) => {
    if (c.email) {
      const email = c.email.trim().toLowerCase();
      clientMap[email] = c.companyName || c.name || email;
    }
  });

  if (clientEmails.length === 0) {
    return NextResponse.json({
      connected: true,
      messages: [],
      gmailUser: settings.gmailUser,
      noClients: true,
    });
  }

  const emailQueryParts = clientEmails.map(e => `from:${e} OR to:${e}`).join(' OR ');
  const clientQuery = `(${emailQueryParts})`;

  const [inboxIds, sentIds] = await Promise.all([
    fetchMessages(accessToken, `in:inbox ${clientQuery}`, 20),
    fetchMessages(accessToken, `in:sent ${clientQuery}`, 10),
  ]);

  const allIds = [...new Set([...inboxIds, ...sentIds])];
  if (allIds.length === 0) {
    return NextResponse.json({ connected: true, messages: [], gmailUser: settings.gmailUser });
  }

  const details = await fetchMessageDetails(accessToken, allIds.slice(0, 25));

  const messages = details
    .filter(Boolean)
    .map((msg: any) => {
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const fromHeader = getHeader('From');
      const toHeader = getHeader('To');
      const { name: senderName, email: senderEmail } = parseFrom(fromHeader);
      const { email: toEmail } = parseFrom(toHeader);

      const isSent = (msg.labelIds || []).includes('SENT');
      const isUnread = (msg.labelIds || []).includes('UNREAD');
      const isStarred = (msg.labelIds || []).includes('STARRED');

      const otherEmail = isSent ? toEmail : senderEmail;
      const clientName = clientMap[otherEmail] || senderName;

      return {
        id: msg.id,
        threadId: msg.threadId,
        sender: isSent ? `You → ${clientName}` : (clientName || senderName),
        senderEmail: isSent ? toEmail : senderEmail,
        subject: getHeader('Subject') || '(No Subject)',
        date: relativeTime(getHeader('Date')),
        rawDate: getHeader('Date'),
        snippet: msg.snippet || '',
        unread: isUnread,
        starred: isStarred,
        isSent,
        isClient: clientEmails.includes(isSent ? toEmail : senderEmail),
      };
    })
    .sort((a: any, b: any) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

  return NextResponse.json({
    connected: true,
    messages,
    gmailUser: settings.gmailUser,
    clientCount: clientEmails.length,
  });
}

export async function DELETE() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase.from('settings').update({
    gmailAccessToken: null,
    gmailRefreshToken: null,
    gmailTokenExpiry: null,
  }).eq('user_id', user.id);
  
  return NextResponse.json({ success: true });
}
