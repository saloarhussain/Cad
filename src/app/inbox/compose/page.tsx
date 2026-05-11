"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDb, sendMessage } from '@/app/actions';

export default function ComposeMessagePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Form State
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const db = await getDb();
      setProjects(db.projects || []);
      if (db.projects && db.projects.length > 0) {
        setProjectRef(db.projects[0].title);
      }
    };
    fetchData();
  }, []);

  const handleSend = async () => {
    if (isSending) return;
    if (!recipient || !content) {
      setNotification({ message: 'Recipient and Content are required.', type: 'error' });
      return;
    }

    setIsSending(true);
    const formData = new FormData();
    formData.append('recipient', recipient);
    formData.append('subject', subject);
    formData.append('projectRef', projectRef);
    formData.append('content', content);

    const result = await sendMessage(formData);
    setIsSending(false);

    if (result.success) {
      setNotification({ message: result.message || 'Sent!', type: 'success' });
      setTimeout(() => router.push('/inbox'), 2000);
    } else {
      setNotification({ message: result.error || 'Failed to send.', type: 'error' });
    }
  };
  return (
    <div className="flex flex-col items-center min-h-screen bg-background pb-32">
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
          notification.type === 'success' 
            ? 'bg-success/20 border-success/30 text-success' 
            : 'bg-error/20 border-error/30 text-error'
        }`}>
          <span className="material-symbols-outlined text-sm">
            {notification.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-xs font-bold uppercase tracking-tight">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#7b7767]/80 backdrop-blur-xl shadow-[0_0_15px_rgba(252,224,3,0.12)]">
        <div className="flex justify-between items-center w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/inbox" className="text-[#fce003] active:scale-95 duration-200 hover:bg-[#fce003]/10 p-2 rounded-lg">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <h1 className="font-headline font-bold tracking-tight text-xl text-[#fce003]">Compose Message</h1>
          </div>
          <button 
            onClick={handleSend}
            disabled={isSending}
            className={`bg-gradient-to-tr from-[#fce003] to-[#FF2626] text-black px-5 py-2 rounded-lg font-bold text-sm tracking-tight active:scale-95 duration-150 shadow-[0_0_15px_rgba(252,224,3,0.3)] uppercase flex items-center gap-2 ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : null}
            {isSending ? 'SENDING...' : 'SEND'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-2xl px-4 pt-24 pb-32 space-y-6">
        <section className="space-y-6 text-left">
          {/* Recipient */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-yellow-400 opacity-70 px-1">Recipient</label>
            <div className="relative rounded-lg bg-surface-container-low border border-white/5 transition-all focus-within:border-yellow-400">
              <input 
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-transparent border-none rounded-lg py-3 px-4 text-on-surface placeholder:text-neutral-600 focus:outline-none focus:ring-0 text-white" 
                placeholder="Search team or client..." 
                type="text"
              />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-yellow-400 opacity-70 px-1">Subject</label>
            <div className="relative rounded-lg bg-surface-container-low border border-white/5 transition-all focus-within:border-yellow-400">
              <input 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent border-none rounded-lg py-3 px-4 text-on-surface placeholder:text-neutral-600 focus:outline-none focus:ring-0 text-white" 
                placeholder="Design revisions for the centerpiece..." 
                type="text"
              />
            </div>
          </div>

          {/* Project Reference */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-yellow-400 opacity-70 px-1">Project Reference</label>
            <div className="relative group">
              <select 
                value={projectRef}
                onChange={(e) => setProjectRef(e.target.value)}
                className="w-full bg-surface-container-low border border-white/5 rounded-lg py-3 px-4 text-on-surface appearance-none focus:outline-none focus:ring-1 focus:ring-yellow-400 cursor-pointer text-white"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.title}>{p.title}</option>
                ))}
                {projects.length === 0 && <option>No projects found</option>}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">expand_more</span>
            </div>
          </div>
        </section>

        {/* Message Content */}
        <section className="space-y-2 text-left">
          <label className="text-[10px] uppercase tracking-widest font-semibold text-yellow-400 opacity-70 px-1">Message Content</label>
          <div className="relative rounded-lg bg-surface-container border border-white/5 transition-all focus-within:border-yellow-400">
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-transparent border-none rounded-lg py-4 px-4 text-on-surface placeholder:text-neutral-600 focus:outline-none focus:ring-0 resize-none text-white" 
              placeholder="Describe the design modifications or technical notes here..." 
              rows={8}
            ></textarea>
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button className="p-2 hover:bg-white/5 rounded-full text-neutral-500 transition-colors">
                <span className="material-symbols-outlined">format_bold</span>
              </button>
              <button className="p-2 hover:bg-white/5 rounded-full text-neutral-500 transition-colors">
                <span className="material-symbols-outlined">format_italic</span>
              </button>
            </div>
          </div>
        </section>

        {/* Attach CAD Assets */}
        <section className="space-y-3 text-left">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-yellow-400 opacity-70">Attach CAD Assets</label>
            <span className="text-[10px] text-cyan-400 font-mono">MAX 50MB</span>
          </div>
          <div className="flex flex-col gap-3">
            <button className="w-full h-16 flex items-center justify-center gap-3 border-2 border-dashed border-white/10 rounded-lg hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all group">
              <span className="material-symbols-outlined text-neutral-500 group-hover:text-yellow-400">add_circle</span>
              <span className="text-xs font-bold text-neutral-500 group-hover:text-white tracking-widest uppercase">BROWSE FILES</span>
            </button>
            
            {/* File Previews */}
            <div className="flex items-center gap-4 bg-surface-container-high rounded-lg p-3 relative group border border-white/5">
              <div className="w-16 h-16 rounded-md bg-surface-container-highest flex items-center justify-center overflow-hidden">
                <span className="material-symbols-outlined text-neutral-600">deployed_code</span>
              </div>
              <div className="flex flex-col min-w-0 pr-8">
                <span className="text-sm font-mono text-cyan-400 truncate font-bold">ring_base_v2.stl</span>
                <span className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-tighter">12.4 MB</span>
              </div>
              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-full text-neutral-500 hover:text-red-400 transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>
        </section>

        {/* Draft Status */}
        <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 px-3 py-2 rounded-full w-fit">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400"></span>
          </span>
          <span className="text-[10px] font-bold text-yellow-400 tracking-widest uppercase">Draft Saved 2m ago</span>
        </div>
      </main>
    </div>
  );
}
