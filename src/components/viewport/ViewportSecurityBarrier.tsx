"use client";

import React, { useState, useEffect } from 'react';
import { requestViewportOtp, verifyViewportOtp } from '@/app/actions';

interface ViewportSecurityBarrierProps {
  projectId: string;
  onVerified: () => void;
  initialEmail?: string;
}

export default function ViewportSecurityBarrier({ projectId, onVerified, initialEmail }: ViewportSecurityBarrierProps) {
  const [email, setEmail] = useState(initialEmail || '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    // Check if already verified in this session
    const sessionKey = `viewport_verified_${projectId}`;
    if (sessionStorage.getItem(sessionKey)) {
      onVerified();
    }
  }, [projectId, onVerified]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await requestViewportOtp(projectId, email);
      if (res.success) {
        setStep('otp');
        setTimer(60); // 60s cooldown for resend
      } else {
        setError(res.error || 'Failed to send verification code.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await verifyViewportOtp(projectId, email, otp);
      if (res.success) {
        sessionStorage.setItem(`viewport_verified_${projectId}`, 'true');
        onVerified();
      } else {
        setError(res.error || 'Invalid verification code.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0a04] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(252,224,3,0.1)]">
            <span className="material-symbols-outlined text-yellow-400 text-3xl">shield_person</span>
          </div>
          <h2 className="font-headline font-black text-2xl text-white uppercase tracking-tight mb-2">Secure Port</h2>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.3em]">Identity Verification Required</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase p-4 rounded-xl mb-6 text-center animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-1">Client Email Address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-500 text-sm">mail</span>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-yellow-400/50 transition-all placeholder:text-neutral-700 font-medium"
                  required
                />
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full electric-gradient text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl shadow-lg shadow-yellow-400/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Send Access Code</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </>
              )}
            </button>
            <p className="text-center text-[9px] text-neutral-600 font-bold uppercase tracking-tighter px-4">
              Access is restricted to authorized project stakeholders only.
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-1 text-center">
              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Enter 6-Digit Code</label>
              <p className="text-[10px] text-neutral-400 font-medium mb-4 italic">Sent to {email}</p>
              <div className="flex justify-center">
                <input 
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full max-w-[200px] bg-white/5 border border-white/10 rounded-2xl py-4 text-center text-3xl font-black tracking-[10px] text-yellow-400 focus:outline-none focus:border-yellow-400 transition-all placeholder:text-neutral-800"
                  autoFocus
                  required
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <button 
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full electric-gradient text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl shadow-lg shadow-yellow-400/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Unlock Viewport</span>
                    <span className="material-symbols-outlined text-sm">key</span>
                  </>
                )}
              </button>
              
              <button 
                type="button"
                onClick={handleRequestOtp}
                disabled={timer > 0 || loading}
                className="w-full py-2 text-[9px] font-black text-neutral-500 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
              >
                {timer > 0 ? `Resend available in ${timer}s` : 'Resend Code'}
              </button>
              
              <button 
                type="button"
                onClick={() => setStep('email')}
                className="w-full py-1 text-[8px] font-bold text-neutral-700 uppercase tracking-widest hover:underline"
              >
                Wrong email? Go back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
