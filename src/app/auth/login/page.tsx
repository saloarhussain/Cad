"use client";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const isSetup = searchParams.get('setup') === 'true';
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  
  const [verifying, setVerifying] = useState(isSetup);

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // If already logged in, check if we were invited to join something
        const invited = searchParams.get('invited') === 'true';
        if (invited) {
          router.replace('/designer?joined=true');
        } else {
          router.replace('/');
        }
      } else if (isSetup) {
        setVerifying(true);
        // Fallback for slower connections
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            router.replace('/');
          } else {
            setVerifying(false);
          }
        }, 2000);
      } else {
        // [HEALING] Force confirm user if they land here from an invitation
        const invited = searchParams.get('invited') === 'true';
        if (invited && email) {
          try {
            const { forceConfirmUser } = await import('../auth-actions');
            await forceConfirmUser(email);
          } catch (e) {
            console.warn('[LoginForm] Failed to auto-confirm user:', e);
          }
        }
        setVerifying(false);
      }
    };
    syncSession();
  }, [isSetup, router, email, searchParams]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSetup) {
        // Designer First Time Setup via Stable Magic Link
        
        // 1. Verify session exists (already established by the Magic Link click)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Authentication session missing. Please click the link in your email again.");
        }

        // 2. Validate password match
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match. Please re-enter.");
        }

        // 3. Update the user's password
        const { error: updateError } = await supabase.auth.updateUser({
          password,
          data: { role: 'designer' }
        });
        
        if (updateError) throw updateError;
        setSuccess(true);
      } else {
        // Standard Login
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (loginError) throw loginError;

        if (data.user) {
          // [HARDENED] Use Server-Side Role Check to bypass RLS issues
          const { getDesignerStatus } = await import('@/app/actions');
          const status = await getDesignerStatus();

          if (status.isDesigner) {
            window.location.href = '/designer';
          } else {
            window.location.href = '/';
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-6 shadow-[0_0_20px_rgba(252,224,3,0.2)]"></div>
        <h3 className="text-white font-headline font-bold text-lg mb-2 tracking-tight">Verifying Secure Access</h3>
        <p className="text-on-surface-variant text-sm max-w-[200px] mx-auto leading-relaxed">
          Please wait while we initialize your professional workstation portal...
        </p>
      </div>
    );
  }

  if (success && isSetup) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-yellow-400/10 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">verified_user</span>
        </div>
        <h2 className="text-xl font-headline font-bold text-white mb-2">Setup Complete</h2>
        <p className="text-on-surface-variant text-sm mb-8">
          Your secure workstation access has been initialized successfully. You are now ready to access your professional portal.
        </p>
        <button 
          onClick={() => window.location.href = '/designer'}
          className="electric-gradient text-black px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-yellow-400/20"
        >
          Enter Workstation
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-black text-white tracking-[0.1em] uppercase italic">
          {isSetup ? 'Setup Workstation' : 'Authenticate'}
        </h2>
        <p className="text-white/40 text-[10px] mt-1 font-bold uppercase tracking-[0.2em]">
          {isSetup ? 'Initialize secure access' : 'Enter credentials'}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-xs font-bold flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
        </div>
      )}

      <form onSubmit={handleAction} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
            Official Email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!initialEmail && isSetup}
            className="w-full bg-surface-container border border-white/5 rounded-xl py-4 px-5 text-white placeholder:text-neutral-700 focus:ring-2 focus:ring-yellow-400 transition-all outline-none disabled:opacity-50"
            placeholder="name@studio.com"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5 ml-1">
            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest">
              {isSetup ? 'Create Password' : 'Password'}
            </label>
            {!isSetup && (
              <Link href="/auth/forgot" className="text-[9px] font-bold text-yellow-400 hover:underline uppercase">
                Forgot?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container border border-white/5 rounded-xl py-4 pl-5 pr-12 text-white placeholder:text-neutral-700 focus:ring-2 focus:ring-yellow-400 transition-all outline-none"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {isSetup && (
          <div>
            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-surface-container border border-white/5 rounded-xl py-4 pl-5 pr-12 text-white placeholder:text-neutral-700 focus:ring-2 transition-all outline-none ${confirmPassword && password !== confirmPassword ? 'ring-2 ring-red-400' : 'focus:ring-yellow-400'}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[10px] text-red-400 font-bold mt-1.5 ml-1 uppercase">Passwords do not match</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <button
            disabled={loading}
            type="submit"
            className="w-full electric-gradient text-black font-black py-5 rounded-xl shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? (
              <span className="animate-spin material-symbols-outlined">progress_activity</span>
            ) : (
              <>
                <span className="uppercase tracking-widest text-xs">
                  {isSetup ? 'Set Your Password' : 'Authenticate Access'}
                </span>
                <span className="material-symbols-outlined text-xl">
                  {isSetup ? 'verified' : 'login'}
                </span>
              </>
            )}
          </button>


        </div>
      </form>

      {!isSetup && (
        <div className="text-center mt-8">
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
            New agent?{' '}
            <Link href="/auth/signup" className="text-yellow-400 font-bold hover:underline">
              Register now
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-20">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
