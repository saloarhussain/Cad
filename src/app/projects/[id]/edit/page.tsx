"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { updateProjectAction, getDb } from '@/app/actions';
import CadFileUpload from '@/components/viewport/CadFileUpload';
import AuthGuard from '@/components/AuthGuard';
import { CloudinaryUpload } from '@/components/CloudinaryUpload';

const DatePickerFacade = ({ label, isDeadline, name, initialValue }: { label: string, isDeadline?: boolean, name?: string, initialValue?: string }) => {
  const [date, setDate] = useState(initialValue || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValue) setDate(initialValue);
  }, [initialValue]);

  const handleClick = () => {
    if (inputRef.current) {
      try {
        inputRef.current.showPicker();
      } catch (e) {}
    }
  };

  const displayDate = date ? date.split('-').reverse().join('/') : "DD/MM/YYYY";

  return (
    <div className="space-y-2 relative">
      <label className={`font-label text-[10px] font-bold uppercase tracking-wider ${isDeadline ? 'text-[#fce003]' : 'text-stone-400'}`}>
        {label}
      </label>
      <div 
        onClick={handleClick}
        className={`w-full bg-surface-container-lowest border ${isDeadline ? 'border-[#fce003]/20' : 'border-transparent'} rounded p-3 focus-within:ring-2 focus-within:ring-[#fce003] transition-all flex justify-between items-center cursor-pointer relative overflow-hidden group`}
      >
        <span className={date ? "text-white" : "text-stone-700"}>
          {displayDate}
        </span>
        <span className="material-symbols-outlined text-white pointer-events-none group-focus-within:text-[#fce003] transition-colors">calendar_month</span>
        <input 
          ref={inputRef}
          type="date"
          name={name}
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="absolute right-0 top-0 w-12 h-full opacity-0 cursor-pointer" 
        />
      </div>
    </div>
  );
};

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, user, isDesigner } = useAuth();
  
  // HOOKS MUST BE AT THE TOP
  const [designers, setDesigners] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fixedItems, setFixedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      const { getDesignerProjectDetail, getDb } = await import('@/app/actions');
      
      const db = await getDb();
      setDesigners(db.designers || []);
      setClients(db.clients || []);
      
      if (isDesigner) {
        const res = await getDesignerProjectDetail(params.id as string);
        if (res.project) {
          setProject(res.project);
        }
      } else {
        const found = db.projects?.find((p: any) => p.id === params.id);
        if (found) {
          setProject(found);
        }
      }
      setLoading(false);
    };
    if (isAuthenticated) fetchData();
  }, [params.id, isAuthenticated, isDesigner]);

  const cleanNote = (note: string) => {
    if (!note) return "";
    // Strip redundant labels and Pos coordinates
    let cleaned = note.replace(/3D VIEWPORT FEEDBACK:/gi, '')
                     .replace(/\(Pos:.*?\)/g, '')
                     .trim();
    
    // Ensure every "Pin #" starts on a new line (except the very first one)
    cleaned = cleaned.replace(/Pin\s*#/g, '\nPin #').trim();
    
    return cleaned;
  };

  const toggleFixed = (id: string) => {
    setFixedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteMedia = async (url: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    
    try {
      const pId = String(params.id);
      const { deleteProjectMedia, getDb } = await import('@/app/actions');
      const result = await deleteProjectMedia(pId, url);

      if (result.success) {
        // Refresh local project data
        const db = await getDb();
        const found = db.projects?.find((p: any) => p.id === pId);
        if (found) setProject(found);
      } else {
        alert(result.error || 'Failed to delete asset.');
      }
    } catch (err) {
      alert('An unexpected error occurred.');
    }
  };

  const handleSubmit = async (formData: FormData) => {
    if (!isAuthenticated) return;
    
    try {
      const pId = String(params.id);
      formData.append('id', pId);
      const result = await updateProjectAction(formData);
      
      if (result.success) {
        router.refresh();
        router.push(`/projects/${pId}`);
      } else {
        alert(`Error: ${result.error || 'Failed to save project. Please check all fields.'}`);
      }
    } catch (err: any) {
      alert(`System Error: ${err.message}`);
    }
  };

  // EARLY RETURNS AFTER HOOKS
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center text-white">
        <h2 className="text-2xl font-headline font-bold mb-4">Project Not Found</h2>
        <Link href="/projects" className="text-[#fce003] hover:underline">Return to Project Studio</Link>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="bg-background text-on-surface font-body min-h-screen relative overflow-hidden pb-32 text-left text-white">
        <div className="fixed top-[20%] left-[-10%] w-[40vw] h-[40vw] bg-[#fce003]/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        <div className="fixed bottom-[10%] right-[-10%] w-[30vw] h-[30vw] bg-[#FEA500]/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>

        <header className="fixed top-0 w-full z-50 bg-[#7b7767]/80 backdrop-blur-xl dark:bg-stone-900/80 shadow-[0_0_20px_rgba(252,224,3,0.12)] flex justify-between items-center px-6 py-4">
          <Link href={`/projects/${params.id}`} className="material-symbols-outlined text-[#fce003] hover:opacity-80 transition-opacity">
            arrow_back
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#fce003]/20">
              <img className="w-full h-full object-cover" alt="profile" src={`https://api.dicebear.com/7.x/shapes/svg?seed=${user?.email || 'CADONCE'}`} />
            </div>
          </div>
        </header>

        <main className={`pt-24 px-4 mx-auto relative ${isDesigner ? 'max-w-3xl' : 'max-w-4xl'}`}>
          {isDesigner ? (
            /* HIGH-STABILITY EDGE-TO-EDGE REVISION CONSOLE */
            <div className="space-y-8 relative isolate">
              {/* Isolated Background Decorations */}
              <div className="absolute inset-0 -z-10 pointer-events-none overflow-visible">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#fce003]/5 blur-[120px] rounded-full animate-pulse"></div>
              </div>

              <div className="flex flex-col items-center text-center relative z-20 mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-1 rounded-full bg-[#fce003] animate-ping"></div>
                  <span className="font-mono text-[8px] font-bold uppercase tracking-[0.4em] text-[#fce003]/60">Revision System Online</span>
                </div>
                <h2 className="font-headline text-5xl font-black tracking-tighter text-white italic uppercase leading-none drop-shadow-2xl">
                  Confirm <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#fce003] to-white/60">Delivery</span>
                </h2>
              </div>

              {/* Items to Fix - Edge-to-Edge Optimized */}
              <div className="relative group z-10">
                <div className="bg-stone-900/20 backdrop-blur-xl rounded-[2.5rem] p-4 sm:p-10 relative overflow-hidden">
                  <h3 className="font-headline text-[10px] font-black text-red-500/80 uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
                    <span className="w-8 h-[1px] bg-red-500/20"></span>
                    <span>Actionable Feedback</span>
                  </h3>
                  
                  <div className="space-y-4 relative z-10">
                    {(project.revisions?.filter((r: any) => r.status === 'Pending') || []).length > 0 ? (
                      (project.revisions?.filter((r: any) => r.status === 'Pending') || []).map((rev: any) => (
                        <div key={rev.id} className="bg-stone-950/40 rounded-3xl p-8 border border-white/[0.03] group/item hover:bg-stone-900/60 transition-all duration-300 relative isolate">
                          <div className="relative z-30">
                            <div className="flex justify-between items-start mb-6">
                              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">{rev.label}</span>
                              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
                                <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">Pending Fix</span>
                              </div>
                            </div>
                            <p className="text-[13px] text-white leading-relaxed font-medium mb-8 whitespace-pre-line border-l border-red-500/30 pl-6 italic opacity-90">
                              {cleanNote(rev.note)}
                            </p>
                            
                            <button 
                              type="button"
                              onClick={() => toggleFixed(rev.id)}
                              className={`w-full py-4.5 rounded-2xl font-black text-[10px] tracking-[0.4em] uppercase transition-all duration-300 flex items-center justify-center gap-4 active:scale-[0.98] border ${
                                fixedItems[rev.id] 
                                  ? 'bg-[#fce003] text-black border-[#fce003] shadow-[0_15px_30px_rgba(252,224,3,0.2)]' 
                                  : 'bg-white/[0.02] text-white/60 border-white/5 hover:border-[#fce003]/30 hover:text-white'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {fixedItems[rev.id] ? 'verified' : 'radio_button_unchecked'}
                              </span>
                              {fixedItems[rev.id] ? 'Item Resolved' : 'Verify as Fixed'}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center opacity-20">
                        <span className="material-symbols-outlined text-5xl mb-4">task_alt</span>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">All Items Resolved</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submission Logic - Clean Integration */}
              <form action={handleSubmit} className="relative z-10">
                <input type="hidden" name="id" value={params.id as string} />
                <input type="hidden" name="title" value={project.title} />
                <input type="hidden" name="orderId" value={project.orderId} />
                <input type="hidden" name="client" value={project.client} />
                <input type="hidden" name="designer" value={project.designer} />
                <input type="hidden" name="revenue" value={project.revenue} />
                <input type="hidden" name="expense" value={project.expense} />
                <input type="hidden" name="orderDate" value={project.orderDate} />
                <input type="hidden" name="deadlineDate" value={project.deadlineDate} />
                <input type="hidden" name="brief" value={project.description || project.brief} />
                <input type="hidden" name="images" value={project.images} />
                <input type="hidden" name="paymentStatus" value={project.paymentStatus} />
                <input type="hidden" name="paidAmount" value={project.paidAmount} />

                <div className="bg-stone-950/40 backdrop-blur-xl p-8 sm:p-12 rounded-[3rem] border border-white/[0.03] shadow-2xl relative isolate">
                  <div className="flex items-center justify-center gap-3 mb-10">
                    <span className="h-[1px] w-12 bg-white/[0.05]"></span>
                    <label className="font-label text-[10px] font-black uppercase tracking-[0.5em] text-[#fce003]/60">Asset Pipeline</label>
                    <span className="h-[1px] w-12 bg-white/[0.05]"></span>
                  </div>

                  <div className="rounded-3xl overflow-hidden bg-stone-950/60 p-1 shadow-inner">
                    <CadFileUpload 
                      projectId={params.id as string} 
                      initialPath={project.cadFile}
                      onUploadSuccess={(path) => {}}
                    />
                  </div>
                  
                  <div className="mt-12 group/btn">
                    <div className="relative">
                      {/* Status Hint for Designer */}
                      {Object.values(fixedItems).filter(Boolean).length === 0 && (project.revisions?.filter((r: any) => r.status === 'Pending') || []).length > 0 && (
                        <div className="flex items-center justify-center gap-2 mb-5 animate-pulse">
                          <span className="material-symbols-outlined text-[14px] text-red-500">lock_reset</span>
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Actionable items pending</span>
                        </div>
                      )}

                      <div className={`absolute -inset-4 bg-[#fce003]/20 blur-2xl rounded-full opacity-0 group-hover/btn:opacity-100 transition-opacity duration-700 -z-10 ${Object.values(fixedItems).filter(Boolean).length === 0 && (project.revisions?.filter((r: any) => r.status === 'Pending') || []).length > 0 ? 'hidden' : ''}`}></div>
                      <button 
                        className={`w-full py-6 rounded-2xl active:scale-[0.97] transition-all duration-500 uppercase tracking-[0.4em] text-xs flex items-center justify-center gap-4 border relative overflow-hidden group/sub shadow-2xl ${
                          Object.values(fixedItems).filter(Boolean).length === 0 && (project.revisions?.filter((r: any) => r.status === 'Pending') || []).length > 0
                            ? 'bg-white/[0.08] text-white/40 border-white/10 cursor-not-allowed backdrop-blur-xl'
                            : 'bg-[#fce003] text-black border-white/40 font-black shadow-[0_20px_50px_rgba(252,224,3,0.5)] cursor-pointer hover:scale-[1.02]'
                        }`} 
                        type="submit"
                        disabled={Object.values(fixedItems).filter(Boolean).length === 0 && (project.revisions?.filter((r: any) => r.status === 'Pending') || []).length > 0}
                      >
                        {/* High-Intensity Shine Animation (Only when active) */}
                        {!(Object.values(fixedItems).filter(Boolean).length === 0 && (project.revisions?.filter((r: any) => r.status === 'Pending') || []).length > 0) && (
                          <>
                            <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[45deg] animate-shine z-0"></div>
                            <div className="absolute inset-0 bg-[#fce003] animate-pulse opacity-20"></div>
                          </>
                        )}
                        
                        {/* Z-Index Protected Content */}
                        <div className="relative z-10 flex items-center justify-center gap-4">
                          <span>Secure Submission</span>
                          <span className="material-symbols-outlined text-lg group-hover/sub:translate-x-1 group-hover/sub:-translate-y-1 transition-transform duration-500">auto_awesome_motion</span>
                        </div>
                      </button>
                    </div>
                    <p className="text-[9px] text-center mt-6 text-white/20 uppercase tracking-[0.3em] font-bold italic">End-to-End Encrypted Delivery Pipeline</p>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* STANDARD ORGANIZATION EDIT FORM */
            <>
              <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <span className="font-label text-[10px] font-bold uppercase tracking-widest text-[#fce003] mb-1 block">Project Workspace</span>
                  <h2 className="font-headline text-4xl font-extrabold tracking-tight text-white uppercase italic">Modify Project</h2>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm font-bold text-stone-400 hover:bg-white/5 rounded transition-all uppercase tracking-widest">DISCARD</button>
                </div>
              </div>

              <form action={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8 space-y-6 text-white">
                  <div className="bg-surface-container p-6 rounded-lg shadow-sm border border-white/5">
                    <h3 className="font-headline text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                      <span className="material-symbols-outlined text-sm text-[#fce003]">info</span> Core Details
                    </h3>
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400">Assigned Client</label>
                          <div className="relative group">
                            <select name="client" required defaultValue={project.client} className="w-full bg-surface-container-lowest border-none rounded p-3 text-on-surface focus:ring-2 focus:ring-[#fce003] transition-all appearance-none cursor-pointer text-white">
                              <option value="">Select Client...</option>
                              {clients.map((c) => (
                                <option key={c.id} value={c.companyName || c.name}>
                                  {c.companyName || c.name}
                                </option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-stone-500">expand_more</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400">Assigned Designer</label>
                          <div className="relative group">
                            <select name="designer" required defaultValue={project.designer} className="w-full bg-surface-container-lowest border-none rounded p-3 text-on-surface focus:ring-2 focus:ring-[#fce003] transition-all appearance-none cursor-pointer text-white">
                              <option value="">Select Designer...</option>
                              {designers.map((d) => (
                                <option key={d.id} value={d.fullName}>
                                  {d.fullName} ({d.specialty})
                                </option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-stone-500">expand_more</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400">Order ID</label>
                        <input name="orderId" required defaultValue={project.orderId} className="w-full bg-surface-container-lowest border-none rounded p-3 text-on-surface focus:ring-2 focus:ring-[#fce003] transition-all text-sm text-white" type="text" />
                      </div>

                      <div className="space-y-4">
                        <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400">Reference Gallery</label>
                        
                        {/* Cloudinary Media Hub */}
                        <div className="bg-stone-950/40 rounded-2xl p-6 border border-white/[0.03] shadow-inner">
                          <CloudinaryUpload 
                            projectId={params.id as string} 
                            onSuccess={async () => {
                              // Manually re-fetch project data to update state
                              const { getDb } = await import('@/app/actions');
                              const db = await getDb();
                              const found = db.projects?.find((p: any) => p.id === params.id);
                              if (found) setProject(found);
                              router.refresh();
                            }} 
                          />
                        </div>

                        {/* Live Asset Preview */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                          {(() => {
                            let items = [];
                            const rawImages = project.images;
                            
                            if (Array.isArray(rawImages)) {
                              items = rawImages;
                            } else if (typeof rawImages === 'string' && rawImages) {
                              if (rawImages.trim().startsWith('[') || rawImages.trim().startsWith('{')) {
                                try {
                                  const parsed = JSON.parse(rawImages);
                                  items = Array.isArray(parsed) ? parsed : [parsed];
                                } catch (e) {
                                  // Not valid JSON, fallback to split
                                  items = rawImages.split(/[\n,]+/).map(url => ({ url: url.trim(), type: 'image' }));
                                }
                              } else {
                                items = rawImages.split(/[\n,]+/).map(url => ({ url: url.trim(), type: 'image' }));
                              }
                            }

                            return items.filter((i: any) => i.url).map((item: any, idx: number) => {
                              const isVideo = item.type === 'video' || item.url?.endsWith('.mp4') || item.url?.includes('/video/upload/');
                              return (
                                <div key={idx} className="group relative aspect-square rounded-xl bg-stone-900 border border-white/5 overflow-hidden shadow-xl">
                                  {isVideo ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                      <span className="material-symbols-outlined text-primary text-xl">play_circle</span>
                                      <span className="text-[6px] font-black text-outline uppercase tracking-widest mt-1">Video</span>
                                    </div>
                                  ) : (
                                    <img src={item.url} alt="Asset" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                  )}
                                  <div className="absolute bottom-1.5 left-1.5 z-20">
                                    <a 
                                      href={item.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-md hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/10 shadow-lg"
                                      title="View Full"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">visibility</span>
                                    </a>
                                  </div>
                                  <div className="absolute bottom-1.5 right-1.5 z-20">
                                    <button 
                                      type="button" 
                                      onClick={() => handleDeleteMedia(item.url)}
                                      className="w-6 h-6 rounded-md bg-red-500/60 backdrop-blur-md hover:bg-red-500/80 text-white flex items-center justify-center transition-all border border-red-500/20 shadow-lg"
                                      title="Delete Asset"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">delete</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        
                        {/* Hidden Input for form submission (to keep existing structure) */}
                        <input 
                          type="hidden" 
                          name="images" 
                          value={Array.isArray(project.images) ? JSON.stringify(project.images) : project.images || ""} 
                        />
                        <p className="text-[8px] text-outline font-bold uppercase tracking-widest text-center mt-2 opacity-50">High-Resolution assets are automatically synced to Cloudinary</p>
                      </div>
                      
                      <div className="pt-2">
                        <label className="font-label text-[10px] font-bold uppercase tracking-wider text-[#fce003] block mb-3">CAD File Upload</label>
                        <CadFileUpload 
                          projectId={params.id as string} 
                          initialPath={project.cadFile}
                          onUploadSuccess={(path) => {}}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container p-6 rounded-lg shadow-sm border border-white/5">
                    <h3 className="font-headline text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                      <span className="material-symbols-outlined text-sm text-[#fce003]">payments</span> Financial Logic
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400">Revenue</label>
                        <div className="relative flex items-center bg-surface-container-lowest rounded overflow-hidden">
                          <div className="relative">
                            <select 
                              name="revenueCurrency" 
                              defaultValue={project.revenueCurrency || "$"}
                              className="bg-transparent border-none py-3 pl-3 pr-8 text-[#fce003] font-bold text-sm focus:ring-0 appearance-none cursor-pointer"
                            >
                              <option value="$" className="text-stone-900 bg-white">$ (USD)</option>
                              <option value="€" className="text-stone-900 bg-white">€ (EUR)</option>
                              <option value="£" className="text-stone-900 bg-white">£ (GBP)</option>
                              <option value="¥" className="text-stone-900 bg-white">¥ (JPY)</option>
                              <option value="₹" className="text-stone-900 bg-white">₹ (INR)</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[#fce003] scale-75">expand_more</span>
                          </div>
                          <input name="revenue" required defaultValue={project.revenue} className="w-full bg-transparent border-none p-3 text-white focus:ring-0" type="number" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400">Expense</label>
                        <div className="relative flex items-center bg-surface-container-lowest rounded overflow-hidden">
                          <div className="relative">
                            <select 
                              name="expenseCurrency" 
                              defaultValue={project.expenseCurrency || "₹"}
                              className="bg-transparent border-none py-3 pl-3 pr-8 text-error font-bold text-sm focus:ring-0 appearance-none cursor-pointer"
                            >
                              <option value="$" className="text-stone-900 bg-white">$ (USD)</option>
                              <option value="€" className="text-stone-900 bg-white">€ (EUR)</option>
                              <option value="£" className="text-stone-900 bg-white">£ (GBP)</option>
                              <option value="¥" className="text-stone-900 bg-white">¥ (JPY)</option>
                              <option value="₹" className="text-stone-900 bg-white">₹ (INR)</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-error scale-75">expand_more</span>
                          </div>
                          <input name="expense" required defaultValue={project.expense} className="w-full bg-transparent border-none p-3 text-white focus:ring-0" type="number" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-4 space-y-6">
                  <div className="bg-surface-container-high p-6 rounded-lg border border-white/5">
                    <h3 className="font-headline text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                      <span className="material-symbols-outlined text-sm text-[#fce003]">calendar_today</span> Timeline
                    </h3>
                    <div className="space-y-5">
                      <DatePickerFacade name="orderDate" label="Order Date" initialValue={project.orderDate} />
                      <DatePickerFacade name="deadlineDate" label="Deadline Date" isDeadline={true} initialValue={project.deadlineDate} />
                    </div>
                  </div>

                  <div className="bg-surface-container p-6 rounded-lg shadow-sm border border-white/5 text-white">
                    <h3 className="font-headline text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                      <span className="material-symbols-outlined text-sm text-[#fce003]">precision_manufacturing</span> Specifications
                    </h3>
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">Project Title</label>
                        <input name="title" required defaultValue={project.title} className="w-full bg-surface-container-lowest border-none rounded-lg p-3 text-white" type="text" />
                      </div>
                       <div className="space-y-2">
                        <label className="font-label text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">Design Brief</label>
                        <textarea name="brief" required defaultValue={project.description || project.brief} className="w-full bg-surface-container-lowest border-none rounded-lg p-3 text-sm resize-none text-white" rows={4}></textarea>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button className="w-full electric-gradient text-[#383100] font-black py-4 rounded-lg shadow-[0_0_20px_rgba(252,224,3,0.3)] active:scale-95 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2 border border-white/10" type="submit">
                      <span>Save Changes</span>
                      <span className="material-symbols-outlined">bolt</span>
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
