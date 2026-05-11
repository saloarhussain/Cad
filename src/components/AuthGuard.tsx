'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading, isDesigner, subscription } = useAuth();
  const [hasMounted, setHasMounted] = React.useState(false);
  const router = React.useMemo(() => (typeof window !== 'undefined' ? window.location : null), []);

  React.useEffect(() => {
    setHasMounted(true);
    
    // Role-based Redirection Logic
    if (isAuthenticated && !loading && hasMounted) {
      const pathname = window.location.pathname;
      
      // If Designer is on Organization Home, redirect to Designer Workstation
      if (isDesigner && pathname === '/') {
        window.location.href = '/designer';
      }
      
      // If Organization Owner is on Designer Workstation, redirect to Organization Home
      if (!isDesigner && pathname === '/designer') {
        window.location.href = '/';
      }
    } else if (!isAuthenticated && !loading && hasMounted) {
      // [NEW] Invite Awareness: If landed on a restricted page but has setup intent (email in URL)
      const params = new URLSearchParams(window.location.search);
      if (params.has('email')) {
        window.location.href = `/auth/setup${window.location.search}`;
        return;
      }
    }
  }, [isAuthenticated, isDesigner, loading, hasMounted]);

  if (loading || !hasMounted) {
    return (
      <div className="fixed inset-0 z-[999] bg-[#0c0a04] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-container border border-white/5 animate-pulse flex items-center justify-center">
            <span className="material-symbols-outlined text-yellow-400 animate-spin">progress_activity</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
            Securing Connection
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Safety: If there is an auth hash in the URL AND we are still loading,
    // show the 'Finalizing' screen instead of the 'Restricted' screen.
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (loading && (hash.includes('access_token=') || hash.includes('type=invite'))) {
      return (
        <div className="fixed inset-0 z-[999] bg-[#0c0a04] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-container border border-white/5 animate-pulse flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400 animate-spin">progress_activity</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
              Finalizing Security
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-400/5 blur-[100px] rounded-full pointer-events-none" />

        {/* Lock card */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
          <div className="w-24 h-24 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(252,224,3,0.1)]">
            <span className="material-symbols-outlined text-5xl text-[#fce003]">lock</span>
          </div>

          <p className="text-[10px] font-bold tracking-[0.3em] text-yellow-400/70 uppercase mb-2">
            Organization
          </p>
          <h2 className="text-3xl font-headline font-extrabold text-white tracking-tight mb-3">
            Access Restricted
          </h2>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
            Please log in to access your private CAD data.
          </p>

          <Link
            href={typeof window !== 'undefined' && window.location.search.includes('email=') 
              ? `/auth/setup${window.location.search}` 
              : "/auth/login"}
            className="w-full electric-gradient text-black font-headline font-black py-4 px-8 rounded-xl shadow-[0_0_25px_rgba(252,224,3,0.3)] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              {typeof window !== 'undefined' && window.location.search.includes('email=') ? 'person_add' : 'login'}
            </span>
            {typeof window !== 'undefined' && window.location.search.includes('email=') ? 'Complete My Profile' : 'Log In Now'}
          </Link>
          
          <Link href="/auth/signup" className="mt-6 text-xs font-bold text-neutral-500 hover:text-white transition-colors">
            New Organization? Register Here
          </Link>
        </div>
      </div>
    );
  }

  // Security Check: If authenticated but NOT a designer AND has no organization profile (Free plan fallback means they exist)
  // This blocks "deleted" designers from seeing an empty organization portal.
  const isOrganizationOwner = subscription && subscription.status === 'active';
  
  if (isAuthenticated && !isDesigner && !isOrganizationOwner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-red-500 text-4xl">block</span>
        </div>
        <h2 className="text-2xl font-headline font-black text-white uppercase tracking-tight mb-2">Access Denied</h2>
        <p className="text-on-surface-variant text-sm text-center max-w-xs mb-8">
          Your account is no longer active or does not have permission to access this portal. Please contact your organization administrator.
        </p>
        <Link href="/auth/login" className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">
          Back to Login
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
