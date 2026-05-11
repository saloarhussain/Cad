"use client";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupForm() {
  const searchParams = useSearchParams();
  const isDesigner = searchParams.get('role') === 'designer';
  const initialEmail = searchParams.get('email') || '';

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [selectedRole, setSelectedRole] = useState<'organization' | 'designer'>(isDesigner ? 'designer' : 'organization');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!name) {
        setError(selectedRole === 'organization' ? 'Organization Name is required' : 'Designer Name is required');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!whatsapp || !email) {
        setError('WhatsApp Number and Work Email are required');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent default form submission from firing signup prematurely
    if (step < 3) {
      handleNext();
      return;
    }

    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            organization_name: selectedRole === 'organization' ? name : 'Designer Workstation',
            full_name: selectedRole === 'designer' ? name : null,
            role: selectedRole,
            whatsapp: whatsapp
          }
        }
      });

      if (signupError) {
        if (signupError.message.toLowerCase().includes('already registered')) {
          setError('This email is already registered. Please log in instead.');
          return;
        }
        throw signupError;
      }

      // Detect "Silent Success"
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setError('This email is already registered. Please log in instead.');
        return;
      }

      if (data.user) {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-400/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">mark_email_read</span>
        </div>
        <h2 className="text-xl font-headline font-bold text-white mb-2">
          {selectedRole === 'designer' ? 'Workstation Registered' : 'Check your email'}
        </h2>
        <p className="text-on-surface-variant text-sm mb-8">
          We've sent a verification link to <span className="text-white font-bold">{email}</span>. Please verify your account to unlock your {selectedRole === 'designer' ? 'workstation' : 'portal'}.
        </p>
        <Link 
          href="/auth/login"
          className="text-yellow-400 font-bold text-sm hover:underline uppercase tracking-widest"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-6">
      <div>
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-3xl font-headline font-black text-white tracking-[0.1em] uppercase italic">
            Join the <span className="text-[#fce003]">Studio</span>
          </h2>
          <span className="text-yellow-400 font-bold text-xs bg-yellow-400/10 px-2 py-1 rounded-md whitespace-nowrap">
            Step {step} / 3
          </span>
        </div>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">
          {step === 1 && "Choose your role and identity"}
          {step === 2 && "Provide contact details"}
          {step === 3 && "Secure your workstation"}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-xs font-bold flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
          {error.includes('already registered') && (
            <Link 
              href="/auth/login" 
              className="mt-1 w-full py-2 bg-red-400/20 hover:bg-red-400/30 text-center rounded-lg transition-all border border-red-400/20"
            >
              LOG IN NOW
            </Link>
          )}
        </div>
      )}

      <div className="space-y-4 overflow-hidden relative">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
                Choose Your Role
              </label>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedRole('organization')}
                  className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedRole === 'organization' ? 'electric-gradient text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}
                >
                  Organization
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('designer')}
                  className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedRole === 'designer' ? 'electric-gradient text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}
                >
                  CAD Designer
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
                {selectedRole === 'organization' ? 'Organization' : 'Designer Name'}
              </label>
              <input
                required={step === 1}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container border border-white/5 rounded-xl py-3 px-4 text-white placeholder:text-neutral-700 focus:border-yellow-400 focus:bg-white/5 transition-all outline-none"
                placeholder={selectedRole === 'organization' ? "e.g. Apex Design Studio" : "e.g. John Doe"}
              />
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
                WhatsApp Number
              </label>
              <input
                required={step === 2}
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-surface-container border border-white/5 rounded-xl py-3 px-4 text-white placeholder:text-neutral-700 focus:border-yellow-400 focus:bg-white/5 transition-all outline-none"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
                Work Email
              </label>
              <input
                required={step === 2}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!initialEmail}
                className="w-full bg-surface-container border border-white/5 rounded-xl py-3 px-4 text-white placeholder:text-neutral-700 focus:border-yellow-400 focus:bg-white/5 transition-all outline-none disabled:opacity-50"
                placeholder="name@organization.com"
              />
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
                Password
              </label>
              <input
                required={step === 3}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container border border-white/5 rounded-xl py-3 px-4 text-white placeholder:text-neutral-700 focus:border-yellow-400 focus:bg-white/5 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
                Confirm Password
              </label>
              <input
                required={step === 3}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-surface-container border rounded-xl py-3 px-4 text-white placeholder:text-neutral-700 focus:border-yellow-400 focus:bg-white/5 transition-all outline-none ${confirmPassword && password !== confirmPassword ? 'border-red-500/50' : 'border-white/5'}`}
                placeholder="••••••••"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-4 rounded-xl border border-white/10 hover:bg-white/5 text-white transition-all flex items-center justify-center"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        
        <button
          disabled={loading}
          type={step < 3 ? "button" : "submit"}
          onClick={step < 3 ? handleNext : undefined}
          className="flex-1 electric-gradient text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(252,224,3,0.3)] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-spin material-symbols-outlined">progress_activity</span>
          ) : (
            <>
              <span>{step < 3 ? 'Continue' : (selectedRole === 'designer' ? 'Activate Workstation' : 'Initialize Account')}</span>
              <span className="material-symbols-outlined">{step < 3 ? 'arrow_forward' : (selectedRole === 'designer' ? 'vpn_key' : 'rocket_launch')}</span>
            </>
          )}
        </button>
      </div>

      <div className="text-center mt-6">
        <p className="text-xs text-neutral-500">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-yellow-400 font-bold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
