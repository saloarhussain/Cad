"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';

interface EmailDetail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  html: string | null;
  text: string | null;
  labelIds: string[];
}

function parseEmail(header: string) {
  const match = header.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].replace(/^"|"$/g, '').trim(), email: match[2].trim() };
  return { name: header.trim(), email: header.trim() };
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function SenderAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['from-yellow-400 to-orange-500','from-cyan-400 to-blue-500','from-pink-400 to-rose-500','from-green-400 to-emerald-500','from-purple-400 to-violet-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-black font-black text-sm flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function EmailDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [iframeHeight, setIframeHeight] = useState(400);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/gmail/message/${id}`);
        if (!res.ok) throw new Error('Failed to load email');
        const data = await res.json();
        setEmail(data);
      } catch {
        setError('Could not load this email. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [id]);

  // Inject email HTML into iframe and auto-size it
  useEffect(() => {
    if (!email?.html || !iframeRef.current) return;
    const iframe = iframeRef.current;

    // Dark-mode compatible email wrapper
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #e5e5e5;
            background: transparent;
            word-break: break-word;
          }
          a { color: #fce003; }
          img { max-width: 100%; height: auto; border-radius: 8px; }
          table { max-width: 100% !important; width: 100% !important; }
          td { word-break: break-word; }
          pre, code { white-space: pre-wrap; font-size: 12px; }
          blockquote {
            border-left: 3px solid #444;
            margin: 8px 0;
            padding-left: 12px;
            color: #888;
          }
        </style>
      </head>
      <body>${email.html}</body>
      </html>
    `;

    const blob = new Blob([styledHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    iframe.onload = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight || 400;
        setIframeHeight(Math.min(h + 32, 2000));
      } catch {
        setIframeHeight(600);
      }
      URL.revokeObjectURL(url);
    };
  }, [email]);

  const isSent = email?.labelIds?.includes('SENT');
  const from = email ? parseEmail(email.from) : null;
  const to = email ? parseEmail(email.to) : null;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-32">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-white/5 px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-yellow-400 font-bold text-sm hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Inbox
          </button>
          <div className="flex items-center gap-3">
            {isSent && (
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full">
                Sent
              </span>
            )}
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${email?.threadId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-surface-container transition-colors"
              title="Open in Gmail"
            >
              <span className="material-symbols-outlined text-sm text-neutral-500 hover:text-white transition-colors">open_in_new</span>
            </a>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="px-4 pt-6 space-y-4">
            <div className="h-6 bg-surface-container rounded animate-pulse w-3/4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-surface-container rounded animate-pulse w-1/3" />
                <div className="h-2.5 bg-surface-container rounded animate-pulse w-1/2" />
              </div>
            </div>
            <div className="h-px bg-white/5" />
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-3 bg-surface-container rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 pt-6 text-center">
            <span className="material-symbols-outlined text-4xl text-red-400 block mb-2">error</span>
            <p className="text-red-400 font-bold">{error}</p>
            <button onClick={() => router.back()} className="mt-4 text-yellow-400 text-sm font-bold">← Go back</button>
          </div>
        )}

        {/* Email Content */}
        {!loading && email && (
          <div className="px-4 pt-5 max-w-3xl mx-auto">
            {/* Subject */}
            <h1 className="text-xl font-headline font-extrabold text-white leading-tight mb-5">
              {email.subject}
            </h1>

            {/* Sender card */}
            <div className="flex items-start gap-3 mb-4">
              <SenderAvatar name={isSent ? (to?.name || 'You') : (from?.name || '?')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white">
                    {isSent ? 'You' : (from?.name || from?.email)}
                  </span>
                  {isSent && to && (
                    <span className="text-[10px] text-neutral-500">→ {to.name || to.email}</span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {isSent ? from?.email : from?.email}
                </div>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  {formatDate(email.date)}
                </div>
              </div>
            </div>

            {/* To / From detail row */}
            <div className="mb-4 px-3 py-2 bg-surface-container rounded-lg border border-white/5 text-[11px] space-y-1">
              <div className="flex gap-2">
                <span className="text-neutral-600 w-6">To:</span>
                <span className="text-neutral-400">{email.to}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-neutral-600 w-6">Fr:</span>
                <span className="text-neutral-400">{email.from}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/5 mb-5" />

            {/* Body */}
            {email.html ? (
              <iframe
                ref={iframeRef}
                className="w-full rounded-xl border border-white/5 bg-transparent"
                style={{ height: iframeHeight, minHeight: 200 }}
                sandbox="allow-same-origin"
                title="Email content"
              />
            ) : email.text ? (
              <pre className="whitespace-pre-wrap text-sm text-neutral-300 leading-relaxed font-sans">
                {email.text}
              </pre>
            ) : (
              <p className="text-neutral-500 italic text-sm">{email.snippet}</p>
            )}

            {/* Reply / Forward actions */}
            <div className="mt-8 flex gap-3">
              <a
                href={`https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${isSent ? email.to : email.from}&su=Re: ${encodeURIComponent(email.subject)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-surface-container border border-white/10 rounded-xl text-sm font-bold text-white hover:border-yellow-400/30 transition-all"
              >
                <span className="material-symbols-outlined text-sm text-yellow-400">reply</span>
                Reply
              </a>
              <a
                href={`https://mail.google.com/mail/u/0/?view=cm&fs=1&su=Fwd: ${encodeURIComponent(email.subject)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-surface-container border border-white/10 rounded-xl text-sm font-bold text-white hover:border-yellow-400/30 transition-all"
              >
                <span className="material-symbols-outlined text-sm text-cyan-400">forward</span>
                Forward
              </a>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
