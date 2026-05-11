"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function VerifyHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleVerify = async () => {
      const token = searchParams.get('token');
      const email = searchParams.get('email');
      const type = (searchParams.get('type') || 'magiclink') as any;

      if (!token || !email) {
        setError("Invalid verification link. Please check your email and try again.");
        return;
      }

      try {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email,
          token,
          type,
        });

        if (verifyError) throw verifyError;

        // Successfully verified! Redirect to password setup
        router.push('/auth/login?setup=true');
      } catch (err: any) {
        console.error('Verification error:', err.message);
        setError(err.message || "Verification failed. Your link may have expired.");
      }
    };

    handleVerify();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      {!error ? (
        <>
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(252,224,3,0.2)]"></div>
          <h2 className="text-white font-headline font-bold text-xl mb-2 italic uppercase">Verifying Access</h2>
          <p className="text-on-surface-variant text-sm max-w-[240px] leading-relaxed">
            Please wait while we establish your secure professional workstation session...
          </p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 bg-red-400/10 text-red-400 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>
          <h2 className="text-white font-headline font-bold text-xl mb-2 italic uppercase tracking-tight">Verification Failed</h2>
          <p className="text-red-400/80 text-sm max-w-[280px] mb-8 leading-relaxed font-medium uppercase text-[10px] tracking-widest">
            {error}
          </p>
          <button 
            onClick={() => router.push('/auth/login')}
            className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Back to Login
          </button>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <VerifyHandler />
    </Suspense>
  );
}
