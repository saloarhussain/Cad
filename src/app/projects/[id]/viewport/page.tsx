"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getCadFileUrl } from '@/app/actions';
import ViewportCanvas from '@/components/viewport/ViewportCanvas';
import { MetalType } from '@/components/viewport/JewelryModel';
import { useAuth } from '@/components/AuthProvider';
import ViewportSecurityBarrier from '@/components/viewport/ViewportSecurityBarrier';
import RevisionModal from '@/components/viewport/RevisionModal';
import ApprovalModal from '@/components/viewport/ApprovalModal';
import PaymentHub from '@/components/viewport/PaymentHub';

function ViewportContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const initialEmail = searchParams.get('email') || '';
  
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metalType, setMetalType] = useState<MetalType>('gold');
  const [loading, setLoading] = useState(true);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isPaymentHubOpen, setIsPaymentHubOpen] = useState(false);
  const [isAutoRotate, setIsAutoRotate] = useState(true);

  const balanceDue = project ? (parseFloat(project.revenue || '0') - parseFloat(project.paidAmount || '0')) : 0;
  const revId = searchParams.get('revId');
  const isReviewMode = !!revId;
  const [initialAnnotations, setInitialAnnotations] = useState<any[]>([]);

  useEffect(() => {
    async function loadModel() {
      if (!isAuthenticated && !isVerified) return;

      setLoading(true);
      try {
        const { getViewportProject } = await import('@/app/actions');
        const res = await getViewportProject(projectId);
        
        if (res.success && res.project) {
          const foundProject = res.project;
          setProject(foundProject);
          
          if (revId && foundProject.revisions) {
            const revision = foundProject.revisions.find((r: any) => r.id === revId);
            if (revision && revision.annotations) {
              setInitialAnnotations(revision.annotations);
            }
          }
        }

        const result = await getCadFileUrl(projectId);
        if (result.success && result.signedUrl) {
          setFileUrl(result.signedUrl);
        } else {
          setError(result.error || 'Could not load CAD file.');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadModel();
  }, [projectId, isAuthenticated, isVerified, revId]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0c0a04] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated && !isVerified) {
    return (
      <ViewportSecurityBarrier 
        projectId={projectId} 
        initialEmail={initialEmail} 
        onVerified={() => setIsVerified(true)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0a04] text-white flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`} className="p-2 hover:bg-white/5 rounded-full transition-colors text-yellow-400 active:scale-95">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-headline font-black text-[13px] tracking-tight uppercase">
              {isReviewMode ? 'Feedback Review' : 'Visual Feedback'} <span className="text-yellow-400">Viewport</span>
            </h1>
            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
              {isReviewMode ? 'Designer Review Interface' : 'Master Editor Interface'} • Project {projectId.slice(-6)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`px-2 py-0.5 border rounded-full flex items-center gap-1.5 ${isReviewMode ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400' : 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse bg-yellow-400`}></div>
            <span className="text-[9px] font-black uppercase tracking-widest">{isReviewMode ? 'Review Mode' : 'Live Engine'}</span>
          </div>
        </div>
      </header>

      <main className="flex-grow p-0 md:p-6 flex flex-col md:flex-row gap-0 md:gap-6 overflow-hidden">
        <div className="flex-grow flex flex-col gap-6">
          {!isReviewMode && (
            <div className="flex flex-row gap-3 px-6 md:px-0 pt-6 md:pt-0">
              <button 
                onClick={() => setIsApprovalModalOpen(true)}
                className="flex-1 electric-gradient flex items-center justify-center gap-2 py-3 md:py-2.5 rounded-xl text-black font-black uppercase tracking-widest text-[9px] shadow-[0_0_15px_rgba(252,224,3,0.1)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Approve & Pay</span>
                <span className="material-symbols-outlined font-bold text-xs">payments</span>
              </button>
              <button 
                onClick={() => setIsRevisionModalOpen(true)}
                className="flex-1 bg-white/5 border border-white/10 flex items-center justify-center gap-2 py-3 md:py-2.5 rounded-xl text-white/80 font-black uppercase tracking-widest text-[9px] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-all active:scale-[0.98]"
              >
                <span>Revision</span>
                <span className="material-symbols-outlined font-bold text-xs">history_edu</span>
              </button>
            </div>
          )}

          <div className="flex-grow flex flex-col gap-4">
            {loading ? (
              <div className="flex-grow bg-white/5 md:rounded-3xl flex items-center justify-center border border-white/5 min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-yellow-400 font-headline font-black text-xs tracking-widest uppercase">Initializing GPU Nodes...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-grow bg-white/5 md:rounded-3xl flex items-center justify-center border border-red-500/20 text-center px-10 min-h-[400px]">
                <div className="max-w-md">
                  <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
                  <h3 className="text-xl font-headline font-black text-white uppercase mb-2">Rendering Failed</h3>
                  <p className="text-neutral-500 text-sm mb-6">{error}</p>
                  <Link href={`/projects/${projectId}`} className="electric-gradient px-8 py-3 rounded-xl text-black font-bold uppercase text-xs">Return to Project</Link>
                </div>
              </div>
            ) : fileUrl ? (
              <ViewportCanvas 
                fileUrl={fileUrl} 
                metalType={metalType} 
                projectId={projectId} 
                initialAnnotations={initialAnnotations}
                isReviewMode={isReviewMode}
                isAutoRotate={isAutoRotate}
              />
            ) : null}
          </div>
        </div>

        <aside className="w-full md:w-80 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-3xl p-6 space-y-8">
            <div>
              <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Material Configuration</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'gold', label: '18k Yellow Gold', color: 'bg-[#fcc201]' },
                  { id: 'silver', label: 'Polished Silver', color: 'bg-[#e5e5e5]' },
                  { id: 'rose', label: '18k Rose Gold', color: 'bg-[#f4c2c2]' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetalType(m.id as MetalType)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                      metalType === m.id 
                      ? 'bg-white/10 border-yellow-400/50 shadow-[0_0_15px_rgba(252,224,3,0.1)]' 
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${m.color} shadow-lg shadow-black/20 flex items-center justify-center text-black`}>
                      <span className="material-symbols-outlined text-sm">flare</span>
                    </div>
                    <div className="text-left">
                      <div className={`text-[10px] font-black uppercase tracking-tight ${metalType === m.id ? 'text-yellow-400' : 'text-white'}`}>
                        {m.label}
                      </div>
                      <div className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">High Metalness</div>
                    </div>
                    {metalType === m.id && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-yellow-400"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">View Controls</h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <button 
                  onClick={() => setIsAutoRotate(!isAutoRotate)}
                  className={`p-3 rounded-xl border transition-all active:scale-95 ${
                    isAutoRotate ? 'bg-yellow-400/10 border-yellow-400/50 text-yellow-400' : 'bg-white/5 border-white/5 text-neutral-500'
                  }`}
                >
                  <span className={`material-symbols-outlined text-sm block mb-1 ${isAutoRotate ? 'animate-spin-slow' : ''}`}>rotate_right</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter">Auto-Rotate</span>
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="p-3 bg-white/5 rounded-xl border border-white/5 text-neutral-500 hover:text-white hover:border-white/20 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm block mb-1">zoom_in</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter">Reset View</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-yellow-400/5 border border-yellow-400/10 rounded-3xl p-6">
            <h4 className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-2">Editor Notes</h4>
            <p className="text-[10px] text-neutral-400 leading-relaxed uppercase font-bold italic">
              "The current model is a high-fidelity STL mesh. Real-time light physics are applied to simulate accurate jewelry reflections."
            </p>
          </div>
        </aside>
      </main>

      <RevisionModal 
        projectId={projectId}
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
        onSuccess={(label) => alert(`${label} submitted successfully! The organization has been notified.`)}
      />

      <ApprovalModal
        projectId={projectId}
        projectTitle={project?.title || 'Project'}
        balanceDue={balanceDue}
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        onPaymentRequired={() => {
          setIsApprovalModalOpen(false);
          setIsPaymentHubOpen(true);
        }}
      />

      <PaymentHub
        projectId={projectId}
        balanceDue={balanceDue}
        isOpen={isPaymentHubOpen}
        onClose={() => setIsPaymentHubOpen(false)}
      />
    </div>
  );
}

export default function ViewportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0c0a04] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ViewportContent />
    </Suspense>
  );
}
