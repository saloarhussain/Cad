"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      
      if (resetError) throw resetError;
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full text-center py-8">
        <div className="w-16 h-16 bg-yellow-400/10 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">mark_email_read</span>
        </div>
        <h2 className="text-xl font-headline font-bold text-white mb-2 uppercase italic tracking-wider">Check Your Inbox</h2>
        <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
          We've sent a password reset link to <strong className="text-white">{email}</strong>. Please check your email to continue.
        </p>
        <Link 
          href="/auth/login"
          className="electric-gradient text-black px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-yellow-400/20 inline-block"
        >
          Return to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-black text-white tracking-[0.1em] uppercase italic">
          Reset Password
        </h2>
        <p className="text-white/40 text-[10px] mt-1 font-bold uppercase tracking-[0.2em]">
          Recover your access
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-xs font-bold flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">
            Official Email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface-container border border-white/5 rounded-xl py-4 px-5 text-white placeholder:text-neutral-700 focus:ring-2 focus:ring-yellow-400 transition-all outline-none"
            placeholder="name@studio.com"
          />
        </div>

        <button
          disabled={loading || !email}
          type="submit"
          className="w-full electric-gradient text-black font-black py-5 rounded-xl shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-6"
        >
          {loading ? (
            <span className="animate-spin material-symbols-outlined">progress_activity</span>
          ) : (
            <>
              <span className="uppercase tracking-widest text-xs">
                Send Reset Link
              </span>
              <span className="material-symbols-outlined text-xl">
                send
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
