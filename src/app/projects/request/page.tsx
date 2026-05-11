"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { submitProjectRequest } from '@/app/actions';
import { CloudinaryUpload } from '@/components/CloudinaryUpload';

function ProjectRequestForm() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const clientName = searchParams.get('clientName');

  const [gallery, setGallery] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [deadlineDisplay, setDeadlineDisplay] = useState("DD/MM/YYYY");

  if (!clientId || !clientName) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="bg-surface-container p-8 rounded-3xl border border-white/5 shadow-2xl">
          <span className="material-symbols-outlined text-red-500 text-4xl mb-4">error</span>
          <h2 className="text-xl font-headline font-black text-white uppercase tracking-tight">Invalid Link</h2>
          <p className="text-xs text-neutral-500 mt-2">This project request link is missing valid client credentials. Please contact your organization.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      budget: formData.get('budget') as string,
      currency: formData.get('currency') as string,
      deadlineDate: formData.get('deadlineDate') as string,
      images: gallery,
      clientId: clientId,
      clientName: clientName
    };

    const res = await submitProjectRequest(data);
    if (res.success) {
      setSubmitted(true);
    } else {
      setError(res.error || "Failed to submit request.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="bg-surface-container p-10 rounded-[2.5rem] border border-[#fce003]/20 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-[#fce003]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-[#fce003] text-4xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-headline font-black text-white uppercase tracking-tighter italic">Request Received</h2>
          <p className="text-sm text-neutral-400 mt-3 max-w-xs mx-auto leading-relaxed">
            Your project request for <span className="text-white font-bold">"{clientName}"</span> has been submitted to the Studio. Our team will review it shortly.
          </p>
          <div className="mt-8 pt-8 border-t border-white/5">
             <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Automatic Sync Complete</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0a04] text-white font-body selection:bg-[#fce003] selection:text-black">
      {/* Header */}
      <header className="p-6 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="size-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-[#fce003]">
                <span className="material-symbols-outlined">design_services</span>
             </div>
             <div>
                <h1 className="text-xs font-black uppercase tracking-[0.3em] text-[#fce003]">Project Initialization</h1>
                <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">Secure Studio Intake</p>
             </div>
          </div>
          <div className="text-right">
             <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Partner Identity</p>
             <p className="text-[10px] font-bold text-white">{clientName}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-12 px-6">
        <div className="mb-10 text-left">
          <h2 className="font-headline text-3xl font-black text-white uppercase tracking-tighter italic leading-none mb-4">Start Your <span className="text-[#fce003]">New Project</span></h2>
          <p className="text-neutral-500 text-sm max-w-lg leading-relaxed">
            Provide the tactical details for your next CAD assignment. Your brief will be directly synced to our production workstation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Title Section */}
          <div className="bg-surface-container p-8 rounded-3xl border border-white/5 shadow-xl space-y-8">
            
            {/* Row 1: Title */}
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Project Title</label>
              <input 
                name="title" 
                required 
                placeholder="e.g., Bespoke Emerald Pendant Design"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#fce003]/50 outline-none transition-all placeholder:text-neutral-700" 
              />
            </div>

            {/* Row 2: Currency, Budget, Deadline - THREE EQUAL COLUMNS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Currency</label>
                <select 
                  name="currency"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#fce003]/50 outline-none transition-all appearance-none"
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="AED">AED</option>
                </select>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Target Budget</label>
                <input 
                  name="budget" 
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#fce003]/50 outline-none transition-all placeholder:text-neutral-700" 
                />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Target Deadline *</label>
                <div 
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus-within:border-[#fce003]/50 transition-all flex justify-between items-center cursor-pointer relative overflow-hidden"
                >
                  <span className={deadlineDisplay !== "DD/MM/YYYY" ? "text-white" : "text-neutral-700"}>
                    {deadlineDisplay}
                  </span>
                  <span className="material-symbols-outlined text-white/40 text-lg">calendar_month</span>
                  <input 
                    name="deadlineDate" 
                    type="date"
                    required
                    style={{ colorScheme: 'dark' }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDeadlineDisplay(val ? val.split('-').reverse().join('/') : "DD/MM/YYYY");
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Description */}
            <div className="space-y-2 text-left">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Design Brief & Specification</label>
                <a 
                  href="/projects/sample-brief" 
                  target="_blank"
                  className="text-[9px] font-black text-[#fce003] uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[10px]">info</span>
                  View Reference Guide
                </a>
              </div>
              <textarea 
                name="description" 
                required 
                rows={5}
                placeholder="Describe your vision, dimensions, stone settings, and any technical constraints..."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#fce003]/50 outline-none transition-all resize-none placeholder:text-neutral-700" 
              />
            </div>
          </div>

          {/* Asset Section */}
          <div className="bg-surface-container p-8 rounded-3xl border border-white/5 shadow-xl">
             <div className="flex items-center gap-3 mb-6">
                <div className="size-8 rounded-lg bg-[#fce003]/10 flex items-center justify-center border border-[#fce003]/20">
                   <span className="material-symbols-outlined text-[#fce003] text-lg">collections</span>
                </div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Reference Gallery</h3>
             </div>

             <CloudinaryUpload 
               onUpload={(url, type) => {
                 setGallery(prev => [...prev, { url, type, uploadedAt: new Date().toISOString() }]);
               }}
             />

             {gallery.length > 0 && (
               <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-6">
                 {gallery.map((item, idx) => (
                   <div key={idx} className="group relative aspect-square rounded-xl bg-black border border-white/10 overflow-hidden shadow-2xl">
                     <img src={item.url} alt="Reference" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     <button 
                       type="button"
                       onClick={() => setGallery(prev => prev.filter((_, i) => i !== idx))}
                       className="absolute top-1 right-1 size-6 bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                     >
                       <span className="material-symbols-outlined text-xs">close</span>
                     </button>
                   </div>
                 ))}
               </div>
             )}
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500">
               <span className="material-symbols-outlined text-sm">error</span>
               <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full h-12 bg-gradient-to-r from-[#fce003] to-[#FF2626] rounded-xl text-black font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-[0.98] transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="size-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">bolt</span>
                SUBMIT PROJECT REQUEST
              </>
            )}
          </button>
          
          <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-[0.3em] text-center">
            Secured Submission Node • encrypted transmission
          </p>
        </form>
      </main>
    </div>
  );
}

export default function ProjectRequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="size-8 border-2 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ProjectRequestForm />
    </Suspense>
  );
}
