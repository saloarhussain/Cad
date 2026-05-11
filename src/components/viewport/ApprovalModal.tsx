"use client";

import React, { useState } from 'react';
import { approveProject } from '@/app/actions';

interface ApprovalModalProps {
  projectId: string;
  projectTitle: string;
  balanceDue: number;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRequired: () => void;
}

export default function ApprovalModal({ 
  projectId, 
  projectTitle, 
  balanceDue,
  isOpen, 
  onClose,
  onPaymentRequired
}: ApprovalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'confirm' | 'success'>('confirm');

  if (!isOpen) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await approveProject(projectId);
      if (result.success) {
        setStep('success');
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed top-16 bottom-20 left-0 right-0 z-[90] flex flex-col md:items-center md:justify-center md:p-6 overflow-y-auto bg-[#14120a] md:bg-transparent md:top-0 md:bottom-0">
      {/* Backdrop - Only visible on desktop */}
      <div 
        className="hidden md:block fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative w-full min-h-full md:min-h-0 md:h-auto md:max-w-lg bg-[#14120a] md:border border-white/10 md:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          {step === 'confirm' ? (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#fce003]/10 border border-[#fce003]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[#fce003] text-3xl">verified</span>
                </div>
                <h2 className="text-2xl font-headline font-black text-white uppercase tracking-tight">Final Design Approval</h2>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-2 px-8">
                  By approving, you confirm that the design for <span className="text-white">"{projectTitle}"</span> is complete and ready for final delivery.
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-8">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Final Balance Due</span>
                  <span className="text-xl font-headline font-black text-[#fce003]">${balanceDue.toLocaleString()}</span>
                </div>
                <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">Payment is required to unlock the high-resolution CAD files.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-wider mb-6 animate-shake">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="w-full electric-gradient py-4 rounded-2xl text-black font-black uppercase tracking-widest text-[11px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing Approval...' : 'Confirm Approval & Proceed to Pay'}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl border border-white/5 text-white/50 font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all"
                >
                  Go Back to Review
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-green-500 text-4xl animate-bounce">check_circle</span>
              </div>
              <h2 className="text-2xl font-headline font-black text-white uppercase tracking-tight mb-2">Design Approved!</h2>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-8">Your sign-off has been recorded. Please complete the payment to unlock your master design files.</p>
              
              <button
                onClick={onPaymentRequired}
                className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-[#fce003] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Go to Payment Hub
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
