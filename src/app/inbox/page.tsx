'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/components/AuthProvider';
import { getDesignerDb, getDesignerStatus, getDb, getUnreadCounts, getProjectById } from '@/app/actions';
import { ProjectChat } from '@/components/ProjectChat';

export default function InboxPage() {
  const { user, isDesigner } = useAuth();
  const [mode, setMode] = useState<'gmail' | 'internal' | 'whatsapp'>('internal');
  const [internalProjects, setInternalProjects] = useState<any[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectTitle, setSelectedProjectTitle] = useState<string | null>(null);

  const fetchInternalProjects = useCallback(async (silent = false) => {
    if (!silent) setInternalLoading(true);
    try {
      let projects: any[] = [];
      if (isDesigner) {
        const res = await getDesignerDb();
        projects = res.projects || [];
      } else {
        const db = await getDb();
        projects = db.projects || [];
      }

      const counts = await getUnreadCounts(user?.id || '');
      setUnreadCounts(counts || {});

      // ENSURE SYNC
      const unreadProjectIds = Object.keys(counts || {});
      const existingIds = new Set(projects.map(p => p.id));
      
      for (const id of unreadProjectIds) {
        if (!existingIds.has(id)) {
          const extraProject = await getProjectById(id);
          if (extraProject) {
            projects.push(extraProject);
          }
        }
      }

      setInternalProjects(projects);
      
      // Auto-select first project if none selected on desktop
      if (!selectedProjectId && projects.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedProjectId(projects[0].id);
        setSelectedProjectTitle(projects[0].title);
      }
    } catch (err) {
      console.error('Failed to fetch internal projects', err);
    } finally {
      if (!silent) setInternalLoading(false);
    }
  }, [user, selectedProjectId]);

  useEffect(() => {
    if (user) {
      fetchInternalProjects(false);
      const interval = setInterval(() => fetchInternalProjects(true), 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchInternalProjects]);

  const totalInternalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <AuthGuard>
      <div className="pt-16 h-[calc(100vh)] md:h-screen flex flex-col md:flex-row overflow-hidden bg-background">
        {/* Left Column: Project List */}
        <div className="w-full md:w-[400px] flex flex-col border-r border-white/5 h-full overflow-hidden bg-[#161308]/30 backdrop-blur-sm">
          {/* Header */}
          <header className="p-6 pt-12 md:pt-6 text-left shrink-0">
            <h1 className="text-3xl md:text-2xl font-black text-white uppercase tracking-tighter mb-1">Inbox</h1>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.3em]">Message Hub</p>
          </header>

          {/* Mode Switcher */}
          <div className="px-4 mb-6 shrink-0">
            <div className="flex bg-surface-container rounded-xl p-1 gap-1 border border-white/5 shadow-inner">
              <button 
                onClick={() => setMode('gmail')}
                className={`flex-1 py-1.5 text-[9px] font-label font-black tracking-widest transition-all rounded-lg ${mode === 'gmail' ? 'bg-white/10 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
              >
                GMAIL
              </button>
              <button 
                onClick={() => setMode('internal')}
                className={`flex-1 py-1.5 text-[9px] font-label font-black tracking-widest transition-all rounded-lg relative ${mode === 'internal' ? 'electric-gradient text-black shadow-lg shadow-yellow-400/20' : 'text-neutral-500 hover:text-white'}`}
              >
                INTERNAL
                {totalInternalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[8px] items-center justify-center text-white font-bold">
                      {totalInternalUnread}
                    </span>
                  </span>
                )}
              </button>
              <button 
                onClick={() => setMode('whatsapp')}
                className={`flex-1 py-1.5 text-[9px] font-label font-black tracking-widest transition-all rounded-lg ${mode === 'whatsapp' ? 'bg-white/10 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
              >
                WHATSAPP
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-6 space-y-2 scrollbar-thin scrollbar-thumb-white/5">
            {mode === 'internal' ? (
              <>
                {internalLoading && internalProjects.length === 0 && (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {!internalLoading && internalProjects.length === 0 && (
                  <div className="py-20 text-center opacity-30">
                    <span className="material-symbols-outlined text-4xl mb-2">forum</span>
                    <p className="text-xs font-black uppercase tracking-widest">No active project chats</p>
                  </div>
                )}

                {internalProjects.map(project => {
                  const isSelected = selectedProjectId === project.id;
                  return (
                    <div 
                      key={project.id}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setSelectedProjectTitle(project.title);
                        // On mobile, we might still want to navigate to the full page for better focus
                        if (window.innerWidth < 768) {
                          window.location.href = `/projects/${project.id}?tab=chat`;
                        }
                      }}
                      className={`block rounded-2xl p-4 border transition-all cursor-pointer group relative overflow-hidden ${
                        isSelected 
                          ? 'bg-white/5 border-[#fce003]/30 shadow-[0_0_20px_rgba(252,224,3,0.05)]' 
                          : 'bg-surface-container/50 border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      {unreadCounts[project.id] > 0 && (
                        <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-red-500 rounded-bl-xl z-10 shadow-lg">
                          <span className="text-[10px] font-black text-white">{unreadCounts[project.id]}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-[#fce003]/20 border border-[#fce003]/30' : 'bg-white/5 border border-white/10'
                        }`}>
                          <span className={`material-symbols-outlined text-sm ${isSelected ? 'text-[#fce003]' : 'text-neutral-500 group-hover:text-white'}`}>deployed_code</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className={`text-[11px] font-black uppercase truncate ${isSelected ? 'text-[#fce003]' : 'text-white/80'}`}>{project.title}</h3>
                            <span className="text-[7px] font-bold text-neutral-500 uppercase shrink-0">#{project.orderId?.slice(-6)}</span>
                          </div>
                          <p className="text-[9px] text-neutral-500 line-clamp-1 font-medium italic">Project Workspace Chat</p>
                        </div>
                        <span className={`material-symbols-outlined text-sm transition-transform ${isSelected ? 'text-[#fce003] translate-x-1' : 'text-white/10 group-hover:text-white/30'}`}>chevron_right</span>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="py-20 text-center opacity-30">
                <span className="material-symbols-outlined text-4xl mb-2">cloud_off</span>
                <p className="text-xs font-black uppercase tracking-widest">{mode.toUpperCase()} NOT CONNECTED</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div className="hidden md:flex flex-1 flex-col bg-black/20 h-full overflow-hidden relative">
          {selectedProjectId ? (
            <ProjectChat 
              key={selectedProjectId} 
              projectId={selectedProjectId} 
              projectTitle={selectedProjectTitle || ''} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-20">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-5xl">forum</span>
              </div>
              <h2 className="text-xl font-headline font-black uppercase tracking-tighter text-white mb-2">Initialize Conversation</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] max-w-xs">Select a project from the left pane to access the live CAD workstation chat</p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
