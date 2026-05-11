"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import { getDesignerPortfolio } from '@/app/actions';

export default function DesignerPortfolio() {
  const [projects, setProjects] = useState<any[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await getDesignerPortfolio();
        setProjects(res.projects || []);
        setPortfolioItems(res.portfolioItems || []);
      } catch (err) {
        console.error('Failed to load portfolio data', err);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const totalRevisions = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.revisions?.length || 0), 0);
  }, [projects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0a04] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#0c0a04] text-white font-body pb-32">
        {/* Global Notification */}
        {notification && (
          <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <span className="material-symbols-outlined text-lg">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        )}

        <main className="max-w-5xl mx-auto px-6 pt-24">
          {/* Header */}
          <div className="flex justify-between items-center mb-10">
            <div>
              <Link href="/designer" className="text-[10px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1 hover:text-yellow-300 transition-colors mb-2">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to Workstation
              </Link>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">My Portfolio</h1>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Showcase your work and performance</p>
            </div>
            
            <button
              onClick={async () => {
                const { sharePortfolio } = await import('@/app/actions');
                const res = await sharePortfolio();
                if (res.success) {
                  setNotification({ message: 'Portfolio shared with linked organizations! 🚀', type: 'success' });
                } else {
                  setNotification({ message: res.error || 'Failed to share portfolio.', type: 'error' });
                }
                setTimeout(() => setNotification(null), 5000);
              }}
              className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">share</span>
              Share Profile
            </button>
          </div>

          {/* Performance Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-yellow-400/20 transition-all group">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Completed Projects</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-white">{projects.length}</span>
                <span className="material-symbols-outlined text-yellow-400 opacity-50 group-hover:opacity-100 transition-opacity">task_alt</span>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-yellow-400/20 transition-all group">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Total Revisions Handled</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-white">{totalRevisions}</span>
                <span className="material-symbols-outlined text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity">published_with_changes</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-yellow-400/20 transition-all group">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Avg. Client Rating</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-white">4.8</span>
                <span className="material-symbols-outlined text-yellow-400">star</span>
              </div>
            </div>
          </div>

          {/* Custom Portfolio Items */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-400">imagesmode</span>
                Featured Work
              </h2>
              <button className="px-4 py-2 bg-yellow-400 text-black font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-yellow-400/10 active:scale-95 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">add</span>
                Add Item
              </button>
            </div>

            {portfolioItems.length === 0 ? (
              <div className="bg-white/5 border border-white/5 border-dashed rounded-3xl p-12 text-center">
                <span className="material-symbols-outlined text-white/20 text-4xl mb-4">image_not_supported</span>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">No custom work uploaded yet</p>
                <p className="text-[10px] text-white/20 mt-1">Upload images of your best designs to impress organizations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {portfolioItems.map(item => (
                  <div key={item.id} className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden group hover:border-yellow-400/20 transition-all">
                    <div className="aspect-square bg-black/40 overflow-hidden relative">
                      <img src={item.images?.[0] || 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&auto=format&fit=crop&q=60'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <p className="text-white text-xs font-bold">{item.title}</p>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-[11px] font-black text-white uppercase truncate">{item.title}</h3>
                      <p className="text-[9px] text-white/40 font-medium mt-0.5 truncate">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past Platform Projects */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-400">history</span>
                Platform History
              </h2>
              <span className="text-[9px] font-black text-white/30 uppercase">{projects.length} Projects</span>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
              {projects.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">No completed projects on the platform yet</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {projects.map(project => (
                    <div key={project.id} className="p-5 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 overflow-hidden flex-shrink-0">
                          <img src={project.images?.split(',')[0]} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white uppercase tracking-tight truncate">{project.title}</p>
                          <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-0.5">#{project.orderId}</p>
                        </div>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] font-bold text-white/60">{project.revisions?.length || 0} Revisions</p>
                        <p className="text-[8px] font-black text-green-400 uppercase mt-0.5">Completed</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
