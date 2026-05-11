"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getDb } from '@/app/actions';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/components/AuthProvider';

const getStatusClasses = (status: string) => {
  const s = status?.toLowerCase() || '';
  if (s.includes('urgent')) return 'status-urgent';
  if (s.includes('high')) return 'status-high';
  if (s.includes('pending') || s.includes('review')) return 'text-orange-500';
  if (s.includes('normal')) return 'status-normal';
  if (s.includes('low')) return 'status-low';
  return 'text-yellow-400';
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '--/--/----';
  if (dateStr.includes('/')) return dateStr;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const DeadlineSection = ({ createdAt, deadlineDate }: { createdAt: string, deadlineDate: string }) => {
  const [timeLeft, setTimeLeft] = useState("00D 00H 00M 00S");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const now = new Date();
      const end = new Date(deadlineDate);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00D 00H 00M 00S");
        setProgress(100);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${days.toString().padStart(2, '0')}D ${hours.toString().padStart(2, '0')}H ${minutes.toString().padStart(2, '0')}M ${seconds.toString().padStart(2, '0')}S`
      );

      const start = new Date(createdAt || now);
      const totalDuration = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      setProgress(Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)));
    };
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [createdAt, deadlineDate]);

  return (
    <div className="group">
      <label className="text-[7px] font-bold text-stone-500 uppercase tracking-widest block mb-0.5">Deadline Timer</label>
      <div className="flex items-center gap-1.5 text-white text-left">
        <span className="material-symbols-outlined text-yellow-400 text-[10px] animate-pulse">timer</span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-black text-yellow-400">{timeLeft}</span>
          <span className="font-mono text-[7px] font-bold text-stone-500 uppercase tracking-tighter">Remaining</span>
        </div>
      </div>
      <div className="mt-1.5 h-1 bg-stone-800 rounded-full overflow-hidden">
        <div className="h-full electric-gradient" style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
};

export default function ProjectsPage() {
  const [realProjects, setRealProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const { isAuthenticated, user, isDesigner } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchData = async () => {
      setIsLoading(true);
      const { getDesignerStatus, getDesignerDb, getDb } = await import('@/app/actions');

      let dbProjects = [];
      let dbClients = [];

      if (isDesigner) {
        const designerRes = await getDesignerDb();
        dbProjects = designerRes.projects || [];
        // For clients, we might need to fetch them differently if designers need details
        // but for now, we'll use the basic db
        const fullDb = await getDb();
        dbClients = fullDb.clients || [];
      } else {
        const fullDb = await getDb();
        dbProjects = fullDb.projects || [];
        dbClients = fullDb.clients || [];
      }

      setClients(dbClients);

      const formatted = dbProjects.map((p: any) => {
        const clientInfo = dbClients.find((c: any) => c.name === p.client || c.companyName === p.client);
        return {
          ...p,
          clientCompany: clientInfo?.companyName || 'Independent Partner',
          clientShortName: (clientInfo?.companyName || clientInfo?.name || p.client || '??').slice(0, 2).toUpperCase(),
          tags: p.tags || ['High-Poly', 'Ray-Tracing', 'Nodes']
        };
      });
      setRealProjects(formatted);
      setIsLoading(false);
    };
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, isDesigner]);

  return (
    <AuthGuard>
      {isLoading ? (
        <div className="min-h-screen bg-[#161308] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-[#fce003] uppercase tracking-[0.3em] animate-pulse">Initializing Studio...</span>
          </div>
        </div>
      ) : (
        <div className="pt-20 pb-32 px-6 max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="text-left">
            <h2 className="font-headline text-2xl font-black tracking-tight text-white uppercase italic">
              Project <span className="text-[#fce003]">Studio</span>
            </h2>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">High-fidelity CAD design workspace and queue</p>
          </div>

          <div className="flex items-center bg-white/5 backdrop-blur-xl rounded-2xl p-1 border border-white/10 shadow-2xl">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'active' ? 'electric-gradient text-black shadow-lg shadow-yellow-400/20' : 'text-white/40 hover:text-white'}`}
            >
              Active Queue
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'completed' ? 'electric-gradient text-black shadow-lg shadow-yellow-400/20' : 'text-white/40 hover:text-white'}`}
            >
              Completed
            </button>
          </div>

          {!isDesigner && (
            <Link href="/projects/new" className="electric-gradient text-black px-6 py-3 rounded-xl font-black text-[10px] flex items-center gap-2 active:scale-95 duration-300 shadow-xl uppercase tracking-widest shadow-yellow-400/20 hover:brightness-110">
              <span className="material-symbols-outlined text-base">add_circle</span>
              NEW PROJECT
            </Link>
          )}
        </div>

        {/* Main Layout: Master Editor + Focused Project */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Dynamic Project Cards */}
          {realProjects.filter(p => activeTab === 'completed' ? p.status === 'Completed' : p.status !== 'Completed').length === 0 ? (
            <div className="lg:col-span-12 flex flex-col items-center justify-center py-32 bg-white/[0.02] backdrop-blur-3xl rounded-[2.5rem] border border-white/5 mx-auto w-full max-w-2xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:border-yellow-400/30 transition-all duration-500 shadow-xl relative z-10">
                <span className="material-symbols-outlined text-4xl text-white/20 group-hover:text-[#fce003] group-hover:scale-110 transition-all duration-500">
                  {activeTab === 'active' ? 'rocket_launch' : 'verified'}
                </span>
              </div>
              <h3 className="text-xl font-headline font-black text-white uppercase tracking-[0.3em] italic relative z-10">
                {activeTab === 'active' ? 'Queue Empty' : 'No History'}
              </h3>
              <p className="text-[10px] font-bold text-white/30 mt-3 uppercase tracking-[0.3em] max-w-xs text-center leading-relaxed relative z-10">
                {activeTab === 'active'
                  ? 'The CAD production studio is standing by for new assignments'
                  : 'You haven\'t completed any production cycles yet'}
              </p>
              {activeTab === 'active' && !isDesigner && (
                <Link href="/projects/new" className="mt-10 px-10 py-4 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#fce003] hover:text-black hover:border-[#fce003] transition-all active:scale-95 shadow-xl relative z-10">
                  Launch New Project
                </Link>
              )}
            </div>
          ) : (
            realProjects
              .filter(p => activeTab === 'completed' ? p.status === 'Completed' : p.status !== 'Completed')
              .map((project, idx) => (
                <div key={project.id || idx} className="lg:col-span-4 flex flex-col">
                  <div className="bg-surface-container h-full rounded-lg border border-white/5 flex flex-col p-5 hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
                    <div className="space-y-4 flex-grow relative z-20">
                      <DeadlineSection createdAt={project.createdAt} deadlineDate={project.deadlineDate} />

                      {/* Title & Skills with Badge */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-3 text-left flex-grow">
                          <div>
                            <label className="text-[7px] font-bold text-stone-500 uppercase tracking-widest block mb-0.5">Project Title</label>
                            <p className="font-bold text-[10px] text-white group-hover:text-primary transition-colors">{project.title}</p>
                          </div>
                          {!isDesigner && (
                            <div>
                              <label className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Skills</label>
                              <div className="flex flex-wrap gap-1">
                                {project.tags?.map((tag: string) => (
                                  <span key={tag} className="inline-block px-2 py-0.5 bg-white/5 border border-white/10 text-[9px] font-bold text-neutral-400 uppercase rounded group-hover:border-primary/30 transition-colors">{tag}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Escrow Badge */}
                        {project.useEscrow && project.paymentStatus === 'Escrow Secured' && (
                          <div className="flex-shrink-0">
                            <span className="text-[7px] font-black py-0.5 px-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.5)] border border-amber-400/20">
                              FUNDS SECURED
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Financials (HIDDEN FOR DESIGNERS) */}
                      {!isDesigner && (
                        <div className="grid grid-cols-2 gap-4 text-left border-t border-white/5 pt-3">
                          <div className={`p-2 rounded border ${project.revenueCurrency === '$' ? 'border-red-500' : 'border-[#fce003]'}`}>
                            <label className="text-[7px] font-bold text-stone-500 uppercase tracking-widest block mb-0.5">Revenue</label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-headline font-black text-white">{project.revenueCurrency || '$'}{project.revenue}</span>
                              <span className="material-symbols-outlined text-green-400 text-[12px]">trending_up</span>
                            </div>
                          </div>
                          <div className={`p-2 rounded border ${project.expenseCurrency === '$' ? 'border-red-500' : 'border-[#fce003]'}`}>
                            <label className="text-[7px] font-bold text-stone-500 uppercase tracking-widest block mb-0.5">Expense</label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-headline font-black text-white">{project.expenseCurrency || '₹'}{project.expense}</span>
                              <span className="material-symbols-outlined text-red-400/70 text-[12px]">trending_down</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="h-px bg-white/5 my-0.5"></div>

                      {/* Meta Data Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-left">
                        <div>
                          <label className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-0.5">Order ID</label>
                          <p className="font-mono text-[11px] text-on-surface-variant uppercase">{project.orderId}</p>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5 mb-0.5">
                            Queue Status
                          </label>
                          <p className={`font-mono text-[11px] uppercase ${getStatusClasses(project.status)}`}>
                            {project.status === 'Pending Review' ? (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">inbox</span>
                                REVIEW
                              </span>
                            ) : project.status}
                          </p>
                        </div>




                        {!isDesigner && (
                          <>
                            <div>
                              <label className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-0.5">Client Name</label>
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full bg-stone-800 flex items-center justify-center text-[7px] font-bold border border-white/10 text-yellow-400">
                                  {project.clientShortName}
                                </div>
                                <p className="font-bold text-xs text-white truncate">{project.client}</p>
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-0.5">Company</label>
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-stone-500 text-[11px]">corporate_fare</span>
                                <p className="font-bold text-xs text-white truncate">{project.clientCompany}</p>
                              </div>
                            </div>
                          </>
                        )}
                        {!isDesigner && (
                          <div className="col-span-2">
                            <label className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Assigned Designer</label>
                            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded border border-white/5">
                              <div className="w-5 h-5 rounded-full overflow-hidden border border-yellow-400/30 bg-stone-800 flex items-center justify-center text-[10px] text-yellow-400">
                                {project.designer?.charAt(0)}
                              </div>
                              <p className="font-bold text-xs text-white">{project.designer}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-6 relative z-20 space-y-3">
                      <Link href={`/projects/${project.id}`} className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 rounded-xl group/btn flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg">
                        <span className="font-black text-[9px] uppercase tracking-[0.2em] text-white/40 group-hover/btn:text-white transition-colors">Project Workstation</span>
                        <span className="material-symbols-outlined text-[10px] text-[#fce003]/40 group-hover/btn:text-[#fce003] transition-colors">arrow_forward_ios</span>
                      </Link>

                      {isDesigner && (
                        <Link
                          href={`/projects/${project.id}/edit`}
                          className="w-full py-3 rounded-xl electric-gradient text-black font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-yellow-400/20 hover:shadow-cyan-400/40 transition-all flex items-center justify-center gap-2 group/delivery active:scale-[0.98] border border-white/10"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">rocket_launch</span>
                          {(project.revisions?.length || 0) > 0 ? 'Revised Delivery' : 'Deliver Here'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
        </div>
      )}
    </AuthGuard>
  );
}
