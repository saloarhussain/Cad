"use client";
import React, { useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

import { CountrySearch } from '@/components/CountrySearch';

function SetupHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [country, setCountry] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [detectedRole, setDetectedRole] = useState<'designer' | 'client' | null>(null);
  const emailFromUrl = searchParams.get('email');

  React.useEffect(() => {
    if (emailFromUrl) {
      // Check if user is already registered (they might have clicked an old invite link)
      import('@/app/actions').then(({ checkIfUserIsRegistered }) => {
        checkIfUserIsRegistered(emailFromUrl).then(res => {
          if (res.registered) {
            router.push(`/auth/login?email=${encodeURIComponent(emailFromUrl)}&invited=true`);
          }
        });
      });
    }
  }, [emailFromUrl, router]);

  const nextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!fullName || !mobile) {
      setError("Please complete your identity details.");
      return;
    }
    setError('');
    setStep(2);
  };

  const prevStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      nextStep(e as any);
      return;
    }
    setError('');
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const email = (formData.get('email') as string) || emailFromUrl;
      if (!email) throw new Error("Verification details missing (email).");

      const { data: { session: existingSession } } = await supabase.auth.getSession();
      let session = existingSession;
      let role: 'designer' | 'client' = detectedRole || 'designer';

      // 1. Verification Handshake (if not already logged in)
      if (!session) {
        const { getOnboardingToken } = await import('@/app/actions');
        const tokenRes = await getOnboardingToken(email);
        
        if (!tokenRes.success || !tokenRes.token_hash) {
          throw new Error(tokenRes.error || "Could not generate security token.");
        }

        role = tokenRes.role;
        setDetectedRole(role);

        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenRes.token_hash,
          type: 'magiclink'
        });
        
        if (verifyError) throw verifyError;
        
        const { data: { session: newSession } } = await supabase.auth.getSession();
        session = newSession;
      }

      // 2. Profile Completion
      const country = formData.get('country') as string;

      const { completeOnboardingProfile } = await import('@/app/actions');
      const profileRes = await completeOnboardingProfile({
        email: email,
        role: role,
        fullName: fullName,
        mobile: mobile,
        country: country,
        companyName: companyName
      });

      if (!profileRes.success) throw new Error(profileRes.error);

      // 3. Password Finalization
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        if (role === 'designer') {
          router.push('/designer?joined=true');
        } else if (role === 'client') {
          router.push('/client?joined=true');
        } else {
          router.push('/');
        }
      }, 2000);

    } catch (err: any) {
      console.error('Setup Error:', err.message);
      setError(err.message || "Initialization failed.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(34,197,94,0.1)]">
          <span className="material-symbols-outlined text-5xl">check_circle</span>
        </div>
        <h1 className="text-white font-headline font-black text-3xl mb-4 italic uppercase tracking-tighter">Access Granted</h1>
        <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.2em] max-w-[280px] font-bold opacity-60">
          Your profile is ready. Redirecting to your workstation...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
        <div className="text-center mb-10">
           <div className="inline-block px-4 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full mb-6">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></div>
                 <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em]">Step {step} of 2: {step === 1 ? 'Identity' : 'Security'}</span>
              </div>
           </div>
           <h1 className="text-white font-headline font-black text-3xl md:text-4xl mb-2 italic uppercase tracking-tighter leading-none">
             {step === 1 ? 'Complete Your Profile' : 'Secure Your Account'}
           </h1>
           <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.2em] font-medium opacity-60">
             {step === 1 ? 'Initialize your professional workstation' : 'Create your secure workstation password'}
           </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-400/10 border border-red-400/20 rounded-xl text-center">
            <p className="text-red-400 text-[10px] uppercase font-bold tracking-widest">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Julian Vesta"
                    className="w-full bg-surface-container border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Mobile Number</label>
                  <input 
                    required
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-surface-container border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Country</label>
                <CountrySearch name="country" required onChange={setCountry} />
              </div>

              <button 
                onClick={nextStep}
                className="w-full relative group py-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 rounded-2xl text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all active:scale-[0.98] shadow-[0_20px_40px_rgba(251,191,36,0.2)] flex items-center justify-center gap-3"
              >
                Continue to Security
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Keep Step 1 fields hidden so FormData picks them up on final submit */}
              <input type="hidden" name="fullName" value={fullName} />
              <input type="hidden" name="mobile" value={mobile} />
              <input type="hidden" name="email" value={emailFromUrl || ''} />
              <input type="hidden" name="country" value={country} />
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Company Name (Optional)</label>
                <input 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Vesta Design Studio"
                  className="w-full bg-surface-container border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 transition-all outline-none"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Workstation Password</label>
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Confirm Password</label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full relative group py-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 rounded-2xl text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all active:scale-[0.98] shadow-[0_20px_40px_rgba(251,191,36,0.2)] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      <span>Initializing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Complete Setup</span>
                      <span className="material-symbols-outlined text-sm">rocket_launch</span>
                    </div>
                  )}
                </button>
                
                <button 
                  onClick={prevStep}
                  className="text-[10px] font-bold text-neutral-500 hover:text-white uppercase tracking-widest text-center"
                >
                  Back to Identity
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="mt-12 text-center text-[9px] text-white/20 font-medium uppercase tracking-[0.3em]">
          Precision Design Management Ecosystem
        </p>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#161308] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SetupHandler />
    </Suspense>
  );
}
