"use client";

import React, { useState, useEffect } from 'react';
import { getPaymentSettings, createClientPaymentOrder, verifyClientPayment } from '@/app/actions';

interface PaymentHubProps {
  projectId: string;
  balanceDue: number;
  isOpen: boolean;
  onClose: () => void;
}

interface PaymentMethod {
  id: string;
  type: string; 
  value: string;
  note?: string;
  holder?: string;
  routing?: string;
  bankName?: string;
}

export default function PaymentHub({ projectId, balanceDue, isOpen, onClose }: PaymentHubProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [razorpayKey, setRazorpayKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getPaymentSettings(projectId).then(res => {
        if (res.success) {
          setMethods(res.methods);
          setRazorpayKey(res.razorpayKey || null);
        }
        setLoading(false);
      });
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const getFinalAmount = (method: PaymentMethod | null) => {
    if (method?.type === 'PayPal') return balanceDue * 1.06;
    return balanceDue;
  };

  const finalAmount = getFinalAmount(selectedMethod);

  return (
    <div className="fixed top-16 bottom-20 left-0 right-0 z-[100] flex flex-col md:items-center md:justify-center md:p-4 overflow-y-auto bg-[#1e1c10] md:bg-transparent md:top-0 md:bottom-0">
      {/* Backdrop - Only visible on desktop */}
      <div className="hidden md:block fixed inset-0 bg-[#161308]/95 backdrop-blur-md" onClick={onClose}></div>

      {/* Main Container */}
      <div className="relative z-50 w-full min-h-full md:min-h-0 md:h-auto md:max-w-2xl bg-[#1e1c10] md:rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] border-white/5 md:border flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500">
        
        {/* Left Sidebar: Financial Summary */}
        <div className="w-full md:w-2/5 bg-[#222014] p-6 flex flex-col justify-between border-r border-white/5">
          <div>
            <div className="text-[#fce003] font-black text-[8px] tracking-[0.3em] uppercase mb-4 opacity-70">Invoice Protocol</div>
            <h2 className="text-white font-headline font-black text-base tracking-tighter mb-1 uppercase leading-none">Financial Settlement</h2>
            <p className="text-neutral-500 text-[7px] font-medium leading-relaxed mb-4 uppercase tracking-widest opacity-60">
              Secure transaction gateway for high-precision CAD design assets.
            </p>
            
            <div className="p-4 bg-[#2d2a1d] rounded-xl border-l-4 border-[#fce003] shadow-inner">
              <div className="text-neutral-500 text-[8px] font-black uppercase tracking-widest mb-1 opacity-50">Total Balance Due</div>
              <div className="text-[#fce003] font-headline font-black text-xl tracking-tighter">
                ${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="mt-12 hidden md:flex items-center gap-3">
            <span className="material-symbols-outlined text-[#00fbfe] text-xl">verified_user</span>
            <span className="text-neutral-500 text-[9px] font-black tracking-[0.2em] uppercase">Secure SSL Encrypted</span>
          </div>
        </div>

        {/* Right Panel: Selection */}
        <div className="w-full md:w-3/5 p-8 relative bg-[#1e1c10]">
          <button onClick={onClose} className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>

          <h3 className="text-white font-headline font-black text-sm mb-4 flex items-center gap-2 uppercase tracking-tight">
            <span className="material-symbols-outlined text-[#fce003] text-base">account_balance_wallet</span>
            Select Payment Method
          </h3>

          {loading ? (
            <div className="py-24 text-center">
              <span className="animate-spin material-symbols-outlined text-[#fce003] text-3xl">progress_activity</span>
              <p className="mt-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Accessing Organization Gateways...</p>
            </div>
          ) : methods.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl">
              <span className="material-symbols-outlined text-2xl text-neutral-700 mb-2">settings_input_component</span>
              <p className="text-[7px] font-black text-neutral-500 uppercase tracking-widest">No payment methods configured by organization.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {methods.map((m) => {
                const isBank = m.type.toLowerCase().includes('bank account');
                
                return (
                  <button 
                    key={m.id}
                    onClick={() => setSelectedMethod(m)}
                    className={`relative p-4 rounded-lg border text-left transition-all duration-300 group overflow-hidden ${
                      selectedMethod?.id === m.id 
                        ? 'bg-[#fce003] border-[#fce003] shadow-[0_0_20px_rgba(252,224,3,0.2)]' 
                        : 'bg-[#222014] border-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Electric Border Effect */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity bg-gradient-to-tr from-[#fce003] to-[#00fbfe]`} />
                    
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        selectedMethod?.id === m.id ? 'bg-black/10' : 'bg-white/5'
                      }`}>
                        <span className="material-symbols-outlined text-base">
                          {m.type === 'Binance' ? 'currency_bitcoin' : 
                           m.type === 'PayPal' ? 'payments' : 
                           m.type === 'Payoneer' ? 'public' : 
                           isBank ? 'account_balance' : 'credit_card'}
                        </span>
                      </div>
                      {m.type === 'PayPal' && (
                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${
                          selectedMethod?.id === m.id ? 'bg-black/10 text-black' : 'bg-red-500/10 text-red-500'
                        }`}>+6% FEE</span>
                      )}
                    </div>
                    
                    <div className={`text-xs font-black uppercase tracking-tight relative z-10 ${selectedMethod?.id === m.id ? 'text-black' : 'text-white'}`}>
                      {m.type}
                    </div>
                    <div className={`text-[7px] font-bold uppercase tracking-widest mt-0.5 opacity-50 relative z-10 ${selectedMethod?.id === m.id ? 'text-black' : 'text-neutral-500'}`}>
                      {m.type === 'Payoneer' ? 'Global Transfer' : 
                       isBank ? 'Bank Transfer' : 'Direct Settlement'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Razorpay Instant Checkout Option */}
          {razorpayKey && (
            <button 
              disabled={processing}
              onClick={async () => {
                setProcessing(true);
                const res = await createClientPaymentOrder(projectId, balanceDue);
                if (res.success) {
                  const options = {
                    key: res.keyId,
                    amount: res.amount,
                    currency: res.currency,
                    name: res.organizationName,
                    description: `Balance Settlement: #${projectId.slice(0, 8)}`,
                    order_id: res.orderId,
                    handler: async function (response: any) {
                      const verifyRes = await verifyClientPayment(projectId, balanceDue, response);
                      if (verifyRes.success) {
                        alert('Payment Successful! Project status updated.');
                        onClose();
                        window.location.reload();
                      } else {
                        alert(verifyRes.error || 'Verification failed.');
                      }
                    },
                    modal: {
                      ondismiss: () => setProcessing(false)
                    },
                    theme: { color: "#fce003" }
                  };
                  const rzp = new (window as any).Razorpay(options);
                  rzp.open();
                } else {
                  alert(res.error || 'Failed to initiate checkout.');
                  setProcessing(false);
                }
              }}
              className="w-full mb-6 p-4 rounded-xl border-2 border-[#fce003] bg-[#fce003]/10 flex items-center justify-between group hover:bg-[#fce003] transition-all duration-300 active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#fce003] flex items-center justify-center text-black shadow-lg">
                   <span className="material-symbols-outlined font-black">bolt</span>
                </div>
                <div className="text-left">
                   <p className={`text-xs font-black uppercase tracking-tight ${processing ? 'animate-pulse' : ''}`}>
                     {processing ? 'Connecting Gateway...' : 'Instant Razorpay Checkout'}
                   </p>
                   <p className="text-[7px] font-bold text-neutral-500 group-hover:text-black/60 uppercase tracking-widest">Debit/Credit/UPI/NetBanking</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[#fce003] group-hover:text-black">arrow_forward</span>
            </button>
          )}

          {/* Divider */}
          {methods.length > 0 && razorpayKey && (
            <div className="flex items-center gap-4 mb-6">
               <div className="h-px flex-1 bg-white/5"></div>
               <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Or Manual Settlement</span>
               <div className="h-px flex-1 bg-white/5"></div>
            </div>
          )}

          {/* Dynamic Details / Instructions */}
          {selectedMethod && (
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl mb-8 animate-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-[#fce003] uppercase tracking-widest">{selectedMethod.type} Protocol</span>
                <button 
                  onClick={() => {
                    const text = selectedMethod.type.toLowerCase().includes('bank account') 
                      ? `Holder: ${selectedMethod.holder}\nAccount: ${selectedMethod.value}\n${selectedMethod.routing ? `Code: ${selectedMethod.routing}\n` : ''}Bank: ${selectedMethod.bankName}`
                      : selectedMethod.value;
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-[9px] font-black text-white hover:text-[#fce003] transition-colors uppercase tracking-widest underline decoration-dotted"
                >
                  Copy Details
                </button>
              </div>

              {selectedMethod.type.toLowerCase().includes('bank account') ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                      <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-1 block">Account Holder</span>
                      <p className="text-[10px] font-black text-white uppercase">{selectedMethod.holder || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                      <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-1 block">Account Number</span>
                      <p className="text-[10px] font-mono font-black text-white">{selectedMethod.value || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                      <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-1 block">
                        {selectedMethod.type.includes('USA') ? 'Routing Number' : 
                         selectedMethod.type.includes('UK') ? 'Sort Code / IBAN' : 
                         selectedMethod.type.includes('Australia') ? 'BSB Code' : 'Transit / Swift'}
                      </span>
                      <p className="text-[10px] font-mono font-black text-white">{selectedMethod.routing || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                      <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-1 block">Bank Name</span>
                      <p className="text-[10px] font-black text-white uppercase">{selectedMethod.bankName || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-lg font-mono font-black text-white tracking-widest break-all bg-black/40 p-4 rounded-xl border border-white/5">
                  {selectedMethod.value}
                </div>
              )}
              
              {selectedMethod.note && (
                <p className="mt-4 text-[9px] text-neutral-500 font-bold italic uppercase tracking-tight">
                  Note: {selectedMethod.note}
                </p>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col gap-2">
            <button 
              disabled={!selectedMethod}
              className={`w-full py-3 rounded-lg font-headline font-black text-[9px] tracking-[0.2em] uppercase transition-all duration-300 shadow-xl ${
                selectedMethod 
                  ? 'bg-gradient-to-r from-[#fce003] to-[#84782d] text-black hover:scale-[1.02]' 
                  : 'bg-white/5 text-neutral-600 border border-white/5 cursor-not-allowed'
              }`}
            >
              Request Payment Link
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 border border-white/5 hover:border-white/10 hover:bg-white/5 text-neutral-500 hover:text-white rounded-lg font-headline font-black text-[9px] tracking-[0.2em] uppercase transition-all duration-300"
            >
              I'll Pay Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
