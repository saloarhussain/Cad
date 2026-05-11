"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const [sessionError, setSessionError] = useState('');

  // Explicitly handle session initialization
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // First check if a session already exists (set by server callback)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!existingSession) {
          // Handle Implicit Flow fallback (hash)
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');
            
            if (access_token && refresh_token) {
              const { error } = await supabase.auth.setSession({
                access_token,
                refresh_token
              });
              if (error) throw error;
            }
          }
        }

        // Final verification
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setSessionError('Your reset session has expired or is invalid. Please request a new link.');
        }
      } catch (err: any) {
        setSessionError('Failed to establish secure session: ' + err.message);
      }
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionError('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full text-center py-8">
        <div className="w-16 h-16 bg-yellow-400/10 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">check_circle</span>
        </div>
        <h2 className="text-xl font-headline font-bold text-white mb-2 uppercase italic tracking-wider">Password Updated</h2>
        <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
          Your password has been successfully reset. You can now use your new credentials to authenticate.
        </p>
        <button 
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/auth/login');
          }}
          className="electric-gradient text-black px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-yellow-400/20 inline-block"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-black text-white tracking-[0.1em] uppercase italic">
          New Password
        </h2>
        <p className="text-white/40 text-[10px] mt-1 font-bold uppercase tracking-[0.2em]">
          Secure your account
        </p>
      </div>

      {(error || sessionError) && (
        <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-xs font-bold flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-lg">error</span>
          {error || sessionError}
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
            New Password
          </label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface-container border border-white/5 rounded-xl py-4 px-5 text-white placeholder:text-neutral-700 focus:ring-2 focus:ring-yellow-400 transition-all outline-none"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
            Confirm Password
          </label>
          <input
            required
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full bg-surface-container border border-white/5 rounded-xl py-4 px-5 text-white placeholder:text-neutral-700 focus:ring-2 transition-all outline-none ${confirmPassword && password !== confirmPassword ? 'ring-2 ring-red-400' : 'focus:ring-yellow-400'}`}
            placeholder="••••••••"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[10px] text-red-400 font-bold mt-1.5 ml-1 uppercase">Passwords do not match</p>
          )}
        </div>

        <button
          disabled={loading || !password || !confirmPassword || password !== confirmPassword}
          type="submit"
          className="w-full electric-gradient text-black font-black py-5 rounded-xl shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-6"
        >
          {loading ? (
            <span className="animate-spin material-symbols-outlined">progress_activity</span>
          ) : (
            <>
              <span className="uppercase tracking-widest text-xs">
                Update Password
              </span>
              <span className="material-symbols-outlined text-xl">
                lock_reset
              </span>
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-8">
        <Link href="/auth/login" className="text-[10px] text-yellow-400 font-bold hover:underline uppercase tracking-widest flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[12px]">arrow_back</span>
          Back to Login
        </Link>
      </div>
    </div>
  );
}
