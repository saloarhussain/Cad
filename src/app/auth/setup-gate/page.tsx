"use client";
import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function GateHandler() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  const handleProceed = async () => {
    setLoading(true);
    setError('');
    
    const rawLink = searchParams.get('link');
    if (!rawLink) {
      setError("Invalid or malformed invitation link.");
      setLoading(false);
      return;
    }

    try {
      const decodedLink = decodeURIComponent(rawLink);
      
      // Artificial delay for premium feel and to ensure scanner is long gone
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Direct hand-off to the official security link
      window.location.href = decodedLink;
    } catch (err: any) {
      console.error('Gate Hand-off Error:', err.message);
      setError("Unable to initialize workstation. Please try clicking the email link again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#161308] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-yellow-400/10 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(252,224,3,0.1)]">
        <span className="material-symbols-outlined text-5xl text-yellow-400 animate-pulse">shield_person</span>
      </div>
      
      <h1 className="text-white font-headline font-black text-3xl mb-4 italic uppercase tracking-tighter leading-none">
        Secure Access <br/>
        <span className="text-yellow-400">Verified</span>
      </h1>
      
      <p className="text-on-surface-variant text-sm max-w-[320px] mb-12 leading-relaxed font-medium uppercase tracking-[0.2em] text-[10px]">
        Welcome to the CADONCE Network. Click below to initialize your professional workstation and secure your account.
      </p>
      
      {error && (
        <div className="mb-8 px-6 py-4 bg-red-400/10 border border-red-400/20 rounded-xl max-w-[320px]">
          <p className="text-red-400 text-[10px] uppercase font-bold tracking-widest leading-relaxed">
            {error}
          </p>
        </div>
      )}
      
      <button 
        onClick={handleProceed}
        disabled={loading}
        className="group relative px-12 py-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl text-black font-black text-sm uppercase tracking-widest hover:scale-105 transition-all active:scale-95 shadow-[0_20px_40px_rgba(251,191,36,0.2)] disabled:opacity-50 disabled:scale-100"
      >
        {loading ? (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span>Initializing...</span>
          </div>
        ) : (
          "Enter My Workstation"
        )}
        <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-[9px] text-white/30 whitespace-nowrap group-hover:text-white/60 transition-colors uppercase tracking-[0.3em]">
          Secure Session Initialization
        </span>
      </button>
    </div>
  );
}

export default function SetupGate() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#161308] flex items-center justify-center text-yellow-400/50">
        <div className="animate-spin text-4xl">
          <span className="material-symbols-outlined">refresh</span>
        </div>
      </div>
    }>
      <GateHandler />
    </Suspense>
  );
}
