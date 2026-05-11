"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import { getDesignerDb, sendPayoutReminder } from '@/app/actions';

export default function DesignerDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [designer, setDesigner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [hasMounted, setHasMounted] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(83.5);
  const [displayCurrency, setDisplayCurrency] = useState<'₹' | '$'>('₹');
  const { isAuthenticated, user, isDesigner, loading: authLoading, activeOrganizationId, availableOrganizations, organizationName } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    setHasMounted(true);

    // Load preferred currency from local storage
    const saved = localStorage.getItem('cadonce_dashboard_currency');
    if (saved === '$' || saved === '₹') {
      setDisplayCurrency(saved as '₹' | '$');
    }

    const fetchRate = async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data.rates && data.rates.INR) {
          setExchangeRate(data.rates.INR);
        }
      } catch (err) {
        console.error("Failed to fetch exchange rate", err);
      }
    };
    fetchRate();
  }, []);

  useEffect(() => {
    if (searchParams.get('joined') === 'true' && availableOrganizations.length > 0 && activeOrganizationId) {
      const activeOrg = availableOrganizations.find(o => o.id === activeOrganizationId);
      const orgName = activeOrg?.name || organizationName || 'THE ORGANIZATION';
      setNotification({
        message: `WELCOME TO ${orgName.toUpperCase()}`,
        type: 'success'
      });
      // Clear the URL param without refreshing
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, availableOrganizations, activeOrganizationId, organizationName]);

  const toggleExpand = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatRevisionNote = (note: string) => {
    if (!note) return '';
    return note.split('\n')
      .map(line => {
        // Remove common prefixes and clean up surrounding characters
        let clean = line.replace(/3D VIEWPORT FEEDBACK:/gi, '').trim();
        if (!clean) return null;
        
        // Match old format: "Pin #1: message (Pos: ...)"
        const oldMatch = clean.match(/Pin #(\d+): (.*?) \(Pos:/i);
        if (oldMatch) return `Pin #${oldMatch[1]} - ${oldMatch[2].trim()}`;
        
        // Match current format with parentheses: "(Pin #1 - message)"
        const parenMatch = clean.match(/^\(Pin #(\d+) - (.*?)\)$/i);
        if (parenMatch) return `Pin #${parenMatch[1]} - ${parenMatch[2].trim()}`;
        
        return clean;
      })
      .filter(Boolean)
      .join('\n');
  };

  useEffect(() => {
    const loadDesignerData = async () => {
      if (!activeOrganizationId) return;
      
      setLoading(true);
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
        console.warn('Designer data fetch safety timeout triggered');
      }, 5000);

      try {
        const res = await getDesignerDb(activeOrganizationId);
        console.log('Designer Projects:', res.projects);
        setProjects(res.projects || []);
        setDesigner(res.designer);
      } catch (err) {
        console.error('Failed to load designer data', err);
      } finally {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };

    if (hasMounted && activeOrganizationId) {
      loadDesignerData();
    } else if (hasMounted && !authLoading && availableOrganizations.length === 0) {
      // If auth finished and we definitely have no organizations, stop loading
      setLoading(false);
    }
  }, [activeOrganizationId, hasMounted, authLoading, availableOrganizations]);

  const pendingRevisions = projects.filter(p => 
    p.status === 'Revision Requested' || 
    p.revisions?.some((r: any) => r.status === 'Pending')
  );

  const activeProjects = projects.filter(p => p.status !== 'Approved' && p.status !== 'Complete');

  const unpaidProjects = projects.filter(p => 
    (p.status === 'Approved' || p.status === 'Complete' || p.status === 'Completed') && 
    p.paymentStatus !== 'Paid'
  );

  // Helper to convert to display currency
  const convert = (amount: number, fromCurrency: string) => {
    if (fromCurrency === displayCurrency) return amount;
    if (displayCurrency === '$') {
      return amount / exchangeRate;
    } else {
      return amount * exchangeRate;
    }
  };

  const unpaidBalance = unpaidProjects.reduce((sum, p) => 
    sum + convert(parseFloat(p.expense || '0'), p.expenseCurrency || '₹'), 0);

  // --- Real-time Metrics Calculation ---
  const avgTurnaround = useMemo(() => {
    const completed = projects.filter(p => 
      p.status === 'Completed' || p.status === 'Approved' || p.status === 'Complete'
    );
    if (completed.length === 0) return '0.0h';
    
    const totalMs = completed.reduce((sum, p) => {
      const start = new Date(p.created_at).getTime();
      const end = new Date(p.updated_at).getTime();
      // Ensure we have a valid duration, fallback to 0 if data is messy
      const duration = Math.max(0, end - start);
      return sum + duration;
    }, 0);
    
    const avgMs = totalMs / completed.length;
    const avgHours = avgMs / (1000 * 60 * 60);
    
    if (avgHours < 24) {
      return `${avgHours.toFixed(1)}h`;
    } else {
      const avgDays = avgHours / 24;
      return `${avgDays.toFixed(1)}d`;
    }
  }, [projects]);

  const turnaroundColor = useMemo(() => {
    if (avgTurnaround === '0.0h') return 'text-cyan-400/40';
    const val = parseFloat(avgTurnaround);
    const isDays = avgTurnaround.includes('d');
    
    if (isDays) return 'text-red-400';
    if (val < 6) return 'text-cyan-400';
    if (val < 24) return 'text-yellow-400';
    return 'text-red-400';
  }, [avgTurnaround]);

  const handleRemind = async (projectId: string) => {
    if (!activeOrganizationId) return;
    setRemindingId(projectId);
    try {
      const res = await sendPayoutReminder(projectId, activeOrganizationId);
      if (res.success) {
        setNotification({ type: 'success', message: 'Reminder sent to organization!' });
      } else {
        setNotification({ type: 'error', message: res.error || 'Failed to send reminder.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setRemindingId(null);
      setTimeout(() => setNotification(null), 5000);
    }
  };

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
        {/* Success Modal for Joining Organization */}
        {notification && notification.type === 'success' && notification.message.startsWith('WELCOME TO') && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-[#111111] border border-green-500/30 rounded-3xl p-10 text-center shadow-[0_0_50px_rgba(34,197,94,0.15)] relative overflow-hidden group">
              {/* Background Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-green-500/10 blur-[60px] rounded-full pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="w-20 h-20 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-bounce duration-1000">
                  <span className="material-symbols-outlined text-green-400 text-5xl">check_circle</span>
                </div>
                
                <h2 className="text-white font-headline font-black text-3xl uppercase italic tracking-tighter mb-4 italic">Access Authorized</h2>
                <p className="text-neutral-400 text-sm font-medium mb-2 uppercase tracking-widest text-[10px]">Strategic Partnership Confirmed</p>
                <div className="h-[1px] w-12 bg-green-500/50 mx-auto mb-6"></div>
                
                <p className="text-white font-bold text-lg leading-relaxed mb-10">
                  You have successfully joined <br/>
                  <span className="text-green-400 text-2xl font-black block mt-2 uppercase">{notification.message.replace('WELCOME TO ', '')}</span>
                </p>
                
                <button 
                  onClick={() => setNotification(null)}
                  className="w-full py-5 bg-green-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] active:scale-95"
                >
                  Enter Workstation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Notification (Non-Success-Modal types) */}
        {notification && !(notification.type === 'success' && notification.message.startsWith('WELCOME TO')) && (
          <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <span className="material-symbols-outlined text-lg">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest">{notification.message}</p>
          </div>
        )}

        <main className="max-w-5xl mx-auto px-6 pt-24">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-tight">Workstation</h1>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Welcome back, {user?.user_metadata?.fullName || 'Designer'}</p>
            </div>
            <Link 
              href="/designer/portfolio"
              className="px-4 py-2 bg-yellow-400 text-black font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-yellow-400/10 active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">folder_special</span>
              My Portfolio
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
             <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-yellow-400/20 transition-all group cursor-default">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">My Tasks</span>
                <div className="flex items-end justify-between">
                   <span className="text-2xl font-black text-white">{activeProjects.length}</span>
                   <span className="material-symbols-outlined text-yellow-400 opacity-50 group-hover:opacity-100 transition-opacity">checklist</span>
                </div>
             </div>
             <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-red-500/20 transition-all group cursor-default">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Pending Revisions</span>
                <div className="flex items-end justify-between">
                   <span className="text-2xl font-black text-red-400">{pendingRevisions.length}</span>
                   <span className="material-symbols-outlined text-red-400 animate-pulse">priority_high</span>
                </div>
             </div>
             <div className={`bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-cyan-400/20 transition-all group cursor-default`}>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Avg. Turnaround</span>
                <div className="flex items-end justify-between">
                   <span className={`text-2xl font-black ${turnaroundColor}`}>{avgTurnaround}</span>
                   <span className={`material-symbols-outlined ${turnaroundColor} opacity-50 group-hover:opacity-100 transition-opacity`}>speed</span>
                </div>
             </div>
             <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-orange-500/20 transition-all group cursor-default">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Unpaid Balance</span>
                <div className="flex items-end justify-between">
                    <span className={`text-2xl font-black ${unpaidBalance > 0 ? 'text-orange-500' : 'text-white'}`}>
                      {displayCurrency}{unpaidBalance.toLocaleString(undefined, { maximumFractionDigits: displayCurrency === '₹' ? 0 : 2 })}
                    </span>
                   <span className="material-symbols-outlined text-orange-500 opacity-50 group-hover:opacity-100 transition-opacity">account_balance_wallet</span>
                </div>
             </div>
          </div>

          {/* Priority Action: Pending Revisions */}
          {pendingRevisions.length > 0 && (
            <section id="critical-feedback" className="mb-12 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-grow bg-white/5"></div>
                <h2 className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em]">Critical Feedback</h2>
                <div className="h-px flex-grow bg-white/5"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingRevisions.map(project => {
                  const pendingRev = [...(project.revisions || [])].reverse().find(r => r.status === 'Pending');
                  return (
                    <div key={project.id} className="bg-[#1a1710] border border-red-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4">
                        <span className="px-3 py-1 bg-red-500/20 text-red-500 text-[8px] font-black uppercase rounded-full border border-red-500/20">Action Required</span>
                      </div>
                      
                      <div className="flex gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 overflow-hidden flex-shrink-0">
                          <img src={project.images?.split(',')[0]} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Project</p>
                          <h3 className="text-sm font-black text-white uppercase truncate">{project.title}</h3>
                          <p className="text-[10px] text-yellow-400 font-bold mt-1">Due: {project.deadlineDate || 'ASAP'}</p>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded-2xl p-4 mb-6 border border-white/5">
                         <div className="flex justify-between items-center mb-2">
                           <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Latest Client Comment</p>
                           <span className="text-[8px] font-black text-yellow-400/60 uppercase">Total Revisions: {project.revisions?.length || 0}</span>
                         </div>
                         <p className="text-[11px] text-white/80 italic leading-relaxed line-clamp-2">
                           {formatRevisionNote(pendingRev?.note || 'Click to view details')}
                         </p>

                         {project.revisions?.length > 0 && (
                           <button 
                             onClick={() => toggleExpand(project.id)}
                             className="mt-3 text-[8px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1 hover:text-yellow-300 transition-colors"
                           >
                             {expandedProjects.has(project.id) ? 'Hide History' : `View All Revisions (${project.revisions.length})`}
                             <span className="material-symbols-outlined text-[10px]">{expandedProjects.has(project.id) ? 'expand_less' : 'expand_more'}</span>
                           </button>
                         )}

                         {expandedProjects.has(project.id) && (
                           <div className="mt-4 space-y-3 border-t border-white/5 pt-4 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-yellow-400/20">
                             {[...(project.revisions || [])].reverse().map((rev: any, idx: number) => (
                               <div key={rev.id || idx} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                  <div className="flex justify-between items-center mb-1.5">
                                     <span className="text-[7px] font-black text-yellow-400 uppercase tracking-tighter">
                                       Rev {project.revisions.length - idx}
                                     </span>
                                     <span className="text-[7px] font-bold text-white/20 uppercase">
                                       {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'Previous'}
                                     </span>
                                  </div>
                                  <p className="text-[10px] text-white/70 leading-relaxed italic whitespace-pre-line">{formatRevisionNote(rev.note)}</p>
                               </div>
                             ))}
                           </div>
                         )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                         <Link 
                           href={`/projects/${project.id}/viewport?revId=${pendingRev?.id}`}
                           className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-yellow-400 text-black font-black uppercase tracking-widest text-[9px] shadow-lg shadow-yellow-400/10 active:scale-[0.98] transition-all"
                         >
                           <span className="material-symbols-outlined text-sm">3d_rotation</span>
                           Launch 3D Review
                         </Link>
                         <Link 
                           href={`/projects/${project.id}`}
                           className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[9px] hover:bg-white/10 active:scale-[0.98] transition-all"
                         >
                           <span className="material-symbols-outlined text-sm">open_in_new</span>
                           Details
                         </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Unpaid Payouts Section */}
          {unpaidProjects.length > 0 && (
            <section id="pending-payouts" className="mb-12 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-grow bg-white/5"></div>
                <h2 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">Pending Payouts</h2>
                <div className="h-px flex-grow bg-white/5"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {unpaidProjects.map(project => (
                  <div key={project.id} className="bg-[#1a1710] border border-orange-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 overflow-hidden flex-shrink-0">
                          <img src={project.images?.split(',')[0]} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white uppercase">{project.title}</h3>
                          <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Completed</p>
                        </div>
                      </div>
                      <div className={`text-right p-2 rounded border ${project.expenseCurrency === '$' ? 'border-red-500' : 'border-[#fce003]'}`}>
                        <p className="text-[8px] font-black text-white/40 uppercase mb-1">Due Amount</p>
                        <p className="text-lg font-black text-white">{project.expenseCurrency || '₹'}{project.expense}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleRemind(project.id)}
                      disabled={remindingId === project.id}
                      className="w-full py-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 font-black uppercase tracking-widest text-[9px] hover:bg-orange-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {remindingId === project.id ? 'sync' : 'notifications_active'}
                      </span>
                      {remindingId === project.id ? 'Sending...' : 'Send Payout Reminder'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Regular Queue */}
          <section id="active-queue" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-400">reorder</span>
                  Active Queue
               </h2>
               <span className="text-[9px] font-black text-white/30 uppercase">{activeProjects.length} Projects</span>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
               {/* Desktop Table View */}
               <div className="hidden sm:block overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/5">
                       <tr>
                          <th className="px-6 py-4 text-[9px] font-black text-white/40 uppercase tracking-widest">Project</th>
                          <th className="px-6 py-4 text-[9px] font-black text-white/40 uppercase tracking-widest text-center">Status</th>
                          <th className="px-6 py-4 text-[9px] font-black text-white/40 uppercase tracking-widest text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {activeProjects.map(project => (
                         <tr key={project.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center flex-shrink-0">
                                     <span className="material-symbols-outlined text-xs text-white/40">model_training</span>
                                  </div>
                                  <div>
                                     <p className="text-[11px] font-bold text-white uppercase tracking-tight">{project.title}</p>
                                     <p className="text-[9px] text-white/40 font-medium">#{project.orderId}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex justify-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                    project.status === 'High Priority' ? 'bg-red-500/10 text-red-500 border border-red-500/10' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/10'
                                  }`}>
                                    {project.status}
                                  </span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <Link 
                                 href={`/projects/${project.id}`}
                                 className="text-[9px] font-black text-yellow-400 uppercase tracking-widest hover:underline"
                               >
                                 Manage
                               </Link>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
               </div>

               {/* Mobile Card View */}
               <div className="block sm:hidden divide-y divide-white/5">
                 {activeProjects.map(project => (
                   <div key={project.id} className="p-5 active:bg-white/5 transition-colors">
                     <div className="flex items-start justify-between mb-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                           <span className="material-symbols-outlined text-sm text-yellow-400">deployed_code</span>
                         </div>
                         <div>
                           <p className="text-xs font-black text-white uppercase tracking-tight">{project.title}</p>
                           <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-0.5">#{project.orderId}</p>
                         </div>
                       </div>
                       <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${
                         project.status === 'High Priority' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                       }`}>
                         {project.status}
                       </span>
                     </div>
                     <Link 
                       href={`/projects/${project.id}`}
                       className="w-full flex items-center justify-center py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-widest active:scale-95 transition-all"
                     >
                       Manage Project
                     </Link>
                   </div>
                 ))}
                 {activeProjects.length === 0 && (
                   <div className="p-10 text-center">
                     <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">No active projects in queue</p>
                   </div>
                 )}
               </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
