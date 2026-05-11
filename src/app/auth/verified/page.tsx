"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function VerifiedPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const processVerification = async () => {
      // Keep the session and redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    };
    
    processVerification();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 relative">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-400/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-400/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
        {loading ? (
          <div className="w-24 h-24 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(252,224,3,0.1)]">
            <span className="material-symbols-outlined text-5xl text-yellow-400 animate-spin">progress_activity</span>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-green-400/10 border border-green-400/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(74,222,128,0.2)]">
            <span className="material-symbols-outlined text-5xl text-green-400">task_alt</span>
          </div>
        )}

        <p className="text-[10px] font-bold tracking-[0.3em] text-green-400/70 uppercase mb-2">
          {loading ? 'Verifying Account...' : 'Verification Complete'}
        </p>
        <h2 className="text-3xl font-headline font-extrabold text-white tracking-tight mb-3">
          {loading ? 'Processing...' : 'Your account is successfully created'}
        </h2>
        <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
          {loading 
            ? 'Please wait while we securely verify your email address.'
            : 'Your email has been verified. You can now log in to access your CAD management dashboard.'}
        </p>

        {!loading && (
          <Link
            href="/auth/login"
            className="w-full electric-gradient text-black font-headline font-black py-4 px-8 rounded-xl shadow-[0_0_25px_rgba(252,224,3,0.3)] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>login</span>
            Login Now
          </Link>
        )}
      </div>
    </div>
  );
}
