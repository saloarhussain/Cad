'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function GlobalLoadingShield({ children }: { children: React.ReactNode }) {
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const { isAuthenticated, user, loading: authLoading, isDesigner } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    // 1. Safety Release: Never hang for more than 3.5s
    const timer = setTimeout(() => {
      setIsVerifying(false);
    }, 3500);

    // 2. Auth Loading Logic
    if (!authLoading) {
      setIsVerifying(false);
      clearTimeout(timer);
    }

    return () => clearTimeout(timer);
  }, [pathname, isAuthenticated, authLoading, isDesigner]);

  if (!hasMounted || isVerifying) {
    return (
      <div className="fixed inset-0 z-[999] bg-[#161308] flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#fce003]/5 blur-[120px] rounded-full animate-pulse"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 relative mb-8">
            <div className="absolute inset-0 border-2 border-[#fce003]/20 rounded-2xl rotate-45 animate-[spin_4s_linear_infinite]"></div>
            <div className="absolute inset-2 border-2 border-[#fce003]/40 rounded-xl -rotate-45 animate-[spin_3s_linear_infinite]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-[#fce003] animate-pulse">deployed_code</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <h1 className="font-headline text-2xl font-black tracking-tighter text-white uppercase italic flex items-center gap-2">
              CADONCE <span className="text-[#fce003]">PRISM</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-8 bg-white/10"></div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-white/40 animate-pulse">System Initializing</span>
              <div className="h-[1px] w-8 bg-white/10"></div>
            </div>
          </div>
        </div>

        {/* Technical Deco */}
        <div className="absolute bottom-10 left-10 flex flex-col gap-1 opacity-20">
          <div className="h-1 w-20 bg-white/10"></div>
          <div className="h-1 w-12 bg-white/10"></div>
          <div className="h-1 w-24 bg-white/10"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
