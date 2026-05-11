"use client";
export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import {
  saveSettings,
  getDb,
  getMySettings,
  getDesignerDb,
  getPointsLedger,
  getMyEscrows,
  uploadProfileImage
} from '@/app/actions';
import AuthGuard from '@/components/AuthGuard';
import { CountrySearch } from '@/components/CountrySearch';
import { GLOBAL_CURRENCIES } from '@/lib/config';

const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob failed'));
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export default function SettingsPage() {
  const { isAuthenticated, user, organizationName, logout, loading, isDesigner } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [senderName, setSenderName] = useState('');
  const [gmailClientId, setGmailClientId] = useState('');
  const [gmailClientSecret, setGmailClientSecret] = useState('');
  const [organizationTitle, setOrganizationTitle] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpSecure, setSmtpSecure] = useState(true);

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [countryCode, setCountryCode] = useState('US'); // Default
  const [activeTab, setActiveTab] = useState<'user' | 'email' | 'payment' | 'wallet'>('user');
  const [designerData, setDesignerData] = useState<any>(null);
  const [designerFullName, setDesignerFullName] = useState('');
  const [designerSpecialty, setDesignerSpecialty] = useState('');
  const [designerCountry, setDesignerCountry] = useState('');
  const [designerSkills, setDesignerSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // New Identity State
  const [ownerName, setOwnerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);

  // Wallet State
  const [transferEmail, setTransferEmail] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [organizationEscrows, setOrganizationEscrows] = useState<any[]>([]);
  const [designerEscrows, setDesignerEscrows] = useState<any[]>([]);

  // Currency State
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showGatewayDropdown, setShowGatewayDropdown] = useState(false);
  const currentCurrency = typeof window !== 'undefined' ? localStorage.getItem('cadonce_dashboard_currency') || '₹' : '₹';




  const masterGateways = [
    { type: 'Stripe', regions: ['US', 'IN', 'GB', 'EU', 'CA', 'AU'], recommended: ['US', 'CA', 'GB'] },
    { type: 'Razorpay', regions: ['IN'], recommended: ['IN'] },
    { type: 'Wise', regions: ['GB', 'EU', 'AU', 'SG'], recommended: ['GB', 'EU'] },
    { type: 'Payoneer', regions: ['GLOBAL'], recommended: ['GLOBAL'] },
    { type: 'Binance', regions: ['GLOBAL'], recommended: ['GLOBAL'] },
    { type: 'PayPal', regions: ['GLOBAL'], recommended: ['US', 'EU'] },
    { type: 'Airtm', regions: ['LATAM', 'GLOBAL'], recommended: ['LATAM'] },
    { type: 'Bank Account', regions: ['GLOBAL'], recommended: ['GLOBAL'] },
    { type: 'UPI (India)', regions: ['IN'], recommended: ['IN'] }
  ];

  useEffect(() => {
    // Basic Geolocation Detection
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.country_code) setCountryCode(data.country_code);
      })
      .catch(() => console.log("Geolocation fallback to US"));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadAllData = async () => {
      try {
        // Parallelize all data fetching to eliminate sequential bottlenecks
        const [settingsRes, designerRes, ledgerRes, escrowRes] = await Promise.all([
          getMySettings(),
          isDesigner ? getDesignerDb() : Promise.resolve({ designer: null }),
          getPointsLedger(),
          getMyEscrows()
        ]);

        // 1. Process Basic Settings
        const s = (settingsRes.success && settingsRes.settings) ? settingsRes.settings : {} as any;
        const paymentData = s.payment_methods || [];
        const systemConfig = paymentData.find((m: any) => m.id === 'system_config') || {};

        setGmailUser(s.gmailUser || '');
        setGmailAppPassword(s.gmailAppPassword || '');
        setSenderName(s.senderName || organizationName || user?.user_metadata?.organization_name || '');
        setGmailClientId(s.gmailClientId || '');
        setGmailClientSecret(s.gmailClientSecret || '');
        setOrganizationTitle(s.organizationName || organizationName || user?.user_metadata?.organization_name || '');
        setOwnerName(s.ownerName || user?.user_metadata?.full_name || '');
        setSmtpHost(systemConfig.smtpHost || s.smtpHost || 'smtp.gmail.com');
        setSmtpPort(systemConfig.smtpPort?.toString() || s.smtpPort?.toString() || '465');
        setSmtpSecure(systemConfig.smtpSecure !== undefined ? systemConfig.smtpSecure : (s.smtpSecure !== undefined ? s.smtpSecure : true));
        setPaymentMethods(paymentData.filter((m: any) => m.id !== 'system_config'));

        // 2. Process Designer Profile if applicable
        if (isDesigner && designerRes.designer) {
          const d = designerRes.designer;
          setDesignerData(d);
          setDesignerFullName(d.fullName || '');
          setDesignerSpecialty(d.specialty || '');
          // Robust Fallback for Country: Check Record -> Metadata -> System Config
          const persistentCountry = d.country || user?.user_metadata?.country || s.country || '';
          setDesignerCountry(persistentCountry);
          setDesignerSkills(d.skills || []);
          setWhatsapp(d.whatsapp || d.mobile || '');
          setAvatarUrl(d.avatarUrl || '');
          setPointsBalance(d.pointsBalance || 0);
        } else {
          // Client/Organization fallback or data missing
          setWhatsapp(s.whatsapp || user?.user_metadata?.whatsapp || user?.user_metadata?.mobile || '');
          setAvatarUrl(s.avatarUrl || user?.user_metadata?.avatar_url || '');
          setPointsBalance(s.pointsBalance || 0);
        }

        // 3. Process Ledger and Escrows
        if (ledgerRes.success) setLedger(ledgerRes.ledger || []);
        if (escrowRes.success) {
          setOrganizationEscrows(escrowRes.organizationEscrows || []);
          setDesignerEscrows(escrowRes.designerEscrows || []);
        }
      } catch (err) {
        console.error("Critical data load failed", err);
      } finally {
        setDataLoading(false);
      }
    };
    
    loadAllData();
  }, [isAuthenticated, isDesigner, organizationName]);

  const addPaymentMethod = (type: string) => {
    const newMethod = {
      id: Date.now().toString(),
      type,
      value: '',
      note: type === 'PayPal' ? 'Extra 6% fees included' : ''
    };
    setPaymentMethods([...paymentMethods, newMethod]);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter(m => m.id !== id));
  };

  const updateMethodValue = (id: string, value: string) => {
    setPaymentMethods(paymentMethods.map(m => m.id === id ? { ...m, value } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (isDesigner && designerData?.id) {
        // Designer Profile Update
        const { updateDesigner } = await import('@/app/actions');
        const res = await updateDesigner(designerData.id, {
          fullName: designerFullName,
          specialty: designerSpecialty,
          country: designerCountry,
          skills: designerSkills,
          mobile: whatsapp
        });

        if (res.success) {
          setNotification({ message: 'Profile updated successfully!', type: 'success' });
        } else {
          setNotification({ message: res.error || 'Failed to update profile.', type: 'error' });
        }
      } else {
        // Organization Settings Update
        const { saveAllSettings } = await import('@/app/actions');

        const formData = new FormData();
        formData.append('gmailUser', gmailUser);
        formData.append('gmailAppPassword', gmailAppPassword);
        formData.append('senderName', senderName);
        formData.append('gmailClientId', gmailClientId);
        formData.append('gmailClientSecret', gmailClientSecret);
        formData.append('smtpHost', smtpHost);
        formData.append('smtpPort', smtpPort);
        formData.append('smtpSecure', smtpSecure.toString());
        formData.append('organizationName', organizationTitle);
        formData.append('ownerName', ownerName);
        formData.append('whatsapp', whatsapp);
        formData.append('avatarUrl', avatarUrl);
        formData.append('country', designerCountry);
        formData.append('pointsBalance', pointsBalance.toString());

        const res = await saveAllSettings(formData, paymentMethods);

        if (res.success) {
          setNotification({ message: 'Configuration saved successfully!', type: 'success' });
        } else {
          setNotification({ message: res.error || 'Failed to save settings.', type: 'error' });
        }
      }
    } catch (err: any) {
      setNotification({ message: err.message || 'Error saving settings', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete my account') {
      setNotification({ message: 'Please type the confirmation text correctly', type: 'error' });
      return;
    }

    setIsDeleting(true);
    try {
      const { deleteMyAccount } = await import('@/app/actions');
      const res = await deleteMyAccount();
      if (res.success) {
        logout();
      } else {
        setNotification({ message: res.error || 'Failed to delete account', type: 'error' });
      }
    } catch (err: any) {
      setNotification({ message: err.message || 'Error deleting account', type: 'error' });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Smart Filtering Logic
  const filteredGateways = masterGateways
    .filter(g =>
      g.type.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !paymentMethods.some(pm => pm.type === g.type)
    )
    .sort((a, b) => {
      const aRec = a.recommended.includes(countryCode) || a.recommended.includes('GLOBAL');
      const bRec = b.recommended.includes(countryCode) || b.recommended.includes('GLOBAL');
      return aRec === bRec ? 0 : aRec ? -1 : 1;
    });

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-[#0c0a04] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-8">
           <div className="w-16 h-16 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin shadow-[0_0_30px_rgba(252,224,3,0.2)]"></div>
           <div className="absolute inset-0 flex items-center justify-center">
             <span className="material-symbols-outlined text-yellow-400 text-xl animate-pulse">settings</span>
           </div>
        </div>
        <h2 className="text-white font-headline font-black text-xl uppercase italic tracking-tighter mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700">Initializing Workstation</h2>
        <p className="text-neutral-500 text-[9px] font-black uppercase tracking-[0.3em]">Synchronizing API Protocols & Encrypted Identity</p>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="bg-background text-on-surface font-body min-h-screen pb-24 selection:bg-primary-fixed-dim selection:text-on-primary-fixed animate-in fade-in duration-700">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 transition-all duration-300 ${notification.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'
            }`}>
            <span className="material-symbols-outlined text-sm">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="text-xs font-bold uppercase tracking-tight">{notification.message}</span>
          </div>
        )}

        {/* Top Header */}
        <header className="fixed top-0 z-50 w-full bg-background/95 backdrop-blur-xl flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Spacing for universal back button in TopAppBar */}
            <div className="w-8 h-8" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-black text-white uppercase">{organizationName || 'CAD Organization'}</div>
              <div className="text-[10px] text-neutral-500">{user?.email}</div>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              title="Logout"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="pt-24 px-6 md:px-8 max-w-7xl mx-auto pb-32">
          <div className="flex flex-col lg:flex-row gap-12 text-left">
            {/* Sidebar / Left Column */}
            <div className="w-full lg:w-1/4 shrink-0 space-y-8 lg:sticky lg:top-32 h-fit">
              <section className="space-y-2">
                <h2 className="text-[28px] font-black uppercase tracking-tighter leading-tight text-white">
                  {loading ? '...' : (isDesigner ? 'Designer\nProfile' : 'Organization\nDashboard')}
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">
                  {isDesigner ? 'Personal Workstation Credentials' : 'Command Center & API Protocol'}
                </p>
              </section>

              {/* Tab Navigation */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-6">
                {[
                  { id: 'user', label: 'User Setting', icon: 'person', desc: 'Profile & Global Preferences' },
                  { id: 'payment', label: 'Payment Method', icon: 'payments', desc: 'Billing Gateways & Addresses' },
                  { id: 'wallet', label: 'Wallet & Rewards', icon: 'wallet', desc: 'Ledger, Escrow & Withdrawals' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all group ${activeTab === tab.id
                        ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/10'
                        : 'text-zinc-500 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded flex items-center justify-center border ${activeTab === tab.id ? 'bg-black/10 border-transparent' : 'border-zinc-800 group-hover:border-zinc-700'}`}>
                        <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-tight leading-none mb-1">{tab.label}</p>
                        <p className={`text-[8px] font-bold ${activeTab === tab.id ? 'text-black/60' : 'text-zinc-600'}`}>{tab.desc}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Content Column */}
            <div className="flex-1 space-y-8">
              <form onSubmit={handleSubmit} className="space-y-8 relative">
            {activeTab === 'user' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Account Profile Card */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 relative overflow-hidden group">
                  <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#242424 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row gap-10">
                    {/* Premium Profile Image Uploader */}
                    <div className="w-32 h-32 shrink-0 mx-auto md:mx-0">
                      <div className="w-32 h-32 rounded-full border border-zinc-800 p-1 bg-zinc-900/50 relative overflow-hidden group/avatar">
                        <div className="w-full h-full rounded-full bg-zinc-800/40 flex items-center justify-center overflow-hidden relative">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover grayscale group-hover/avatar:grayscale-0 transition-all duration-500" />
                          ) : (
                            <span className="material-symbols-outlined text-4xl text-zinc-600">person</span>
                          )}

                          {uploadingImage && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                              <span className="animate-spin material-symbols-outlined text-white">progress_activity</span>
                            </div>
                          )}
                        </div>

                        <label className="absolute inset-0 cursor-pointer flex items-center justify-center rounded-full bg-black/0 hover:bg-black/40 transition-all opacity-0 hover:opacity-100 group-hover/avatar:opacity-100 z-20">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadingImage(true);
                                try {
                                  const resizedBlob = await resizeImage(file, 200, 200);
                                  const resizedFile = new File([resizedBlob], 'profile.jpg', { type: 'image/jpeg' });
                                  const { uploadProfileImage } = await import('@/app/actions');
                                  const formData = new FormData();
                                  formData.append('file', resizedFile);
                                  const res = await uploadProfileImage(formData);
                                  if (res.success && res.url) {
                                    const freshUrl = `${res.url}?t=${Date.now()}`;
                                    setAvatarUrl(freshUrl);
                                    const { supabase } = await import('@/lib/supabase');
                                    await supabase.auth.updateUser({ data: { avatar_url: freshUrl } });
                                    setNotification({ message: 'Profile image optimized and saved!', type: 'success' });
                                  } else {
                                    throw new Error(res.error || 'Upload rejected by server');
                                  }
                                } catch (err: any) {
                                  console.error('Resize/Upload failed:', err);
                                  setNotification({ message: `Optimization failed: ${err.message}`, type: 'error' });
                                } finally {
                                  setUploadingImage(false);
                                }
                              }
                            }}
                          />
                          <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {isDesigner ? (
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Professional Identity</label>
                          <input
                            value={designerFullName}
                            onChange={(e) => setDesignerFullName(e.target.value)}
                            className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                            placeholder="Your Full Name"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Organization Name</label>
                            <input
                              value={organizationTitle}
                              onChange={(e) => setOrganizationTitle(e.target.value)}
                              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                              placeholder="Organization"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Owner Name</label>
                            <input
                              value={ownerName}
                              onChange={(e) => setOwnerName(e.target.value)}
                              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                              placeholder="Legal Name"
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Official WhatsApp</label>
                        <input
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                          placeholder="+91 00000 00000"
                        />
                      </div>
                      <div className="space-y-1.5 opacity-60">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Registered Email</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                            <span className="material-symbols-outlined text-sm">lock</span>
                          </div>
                          <input
                            className="w-full bg-zinc-900/20 border border-zinc-800/50 rounded-lg py-3 pl-12 pr-4 text-sm font-medium text-zinc-500 cursor-not-allowed"
                            readOnly
                            value={user?.email || ''}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isDesigner && (
                    <div className="mt-6 pt-6 border-t border-white/5">
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-3">Skills & Expertise</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {designerSkills.map((skill: string) => (
                          <div key={skill} className="group/skill relative">
                            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                              {skill}
                              <button
                                type="button"
                                onClick={() => setDesignerSkills(designerSkills.filter(s => s !== skill))}
                                className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newSkill.trim() && !designerSkills.includes(newSkill.trim())) {
                                setDesignerSkills([...designerSkills, newSkill.trim()]);
                                setNewSkill('');
                              }
                            }
                          }}
                          placeholder="Add Skill (Press Enter)"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] text-white focus:ring-1 focus:ring-yellow-400 outline-none transition-all uppercase tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newSkill.trim() && !designerSkills.includes(newSkill.trim())) {
                              setDesignerSkills([...designerSkills, newSkill.trim()]);
                              setNewSkill('');
                            }
                          }}
                          className="p-2 bg-yellow-400 text-black rounded-xl hover:scale-105 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined">add</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* DASHBOARD DISPLAY CARD */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 relative">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Dashboard Display</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Configure financial metric conversion and visibility</p>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800/30">
                      <span className="material-symbols-outlined text-yellow-400">trending_up</span>
                    </div>
                  </div>

                  <div className="bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-6">
                    <div className="mb-4">
                      <p className="text-[10px] text-zinc-300 font-black uppercase">Primary Currency</p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Used for all global totals</p>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                        className="w-full flex items-center justify-between px-5 py-3 bg-black border border-zinc-800 hover:border-yellow-400/30 rounded-lg transition-all"
                      >
                        <span className="text-sm font-bold text-white">
                          {GLOBAL_CURRENCIES.find(c => c.symbol === currentCurrency)?.code || 'CURRENCY'} ({currentCurrency}) - {GLOBAL_CURRENCIES.find(c => c.symbol === currentCurrency)?.label}
                        </span>
                        <span className="material-symbols-outlined text-yellow-400">expand_more</span>
                      </button>

                      {showCurrencyDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-[100] overflow-hidden p-3 backdrop-blur-3xl animate-in zoom-in-95 duration-200">
                          <div className="relative mb-3">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-500 text-sm">search</span>
                            <input
                              type="text"
                              placeholder="Search global currencies..."
                              value={currencySearchQuery}
                              onChange={(e) => setCurrencySearchQuery(e.target.value)}
                              className="w-full bg-black/40 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400/50 transition-all font-mono"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                            {GLOBAL_CURRENCIES.filter(c => 
                              c.label.toLowerCase().includes(currencySearchQuery.toLowerCase()) || 
                              c.code.toLowerCase().includes(currencySearchQuery.toLowerCase()) ||
                              c.symbol.includes(currencySearchQuery)
                            ).map((curr) => (
                              <button
                                key={curr.code}
                                type="button"
                                onClick={() => {
                                  localStorage.setItem('cadonce_dashboard_currency', curr.symbol);
                                  setNotification({ message: `Protocol Updated: Dashboard synchronized to ${curr.code}`, type: 'success' });
                                  setTimeout(() => window.location.reload(), 1000);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center justify-between group ${currentCurrency === curr.symbol ? 'bg-yellow-400 text-black' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-black ${currentCurrency === curr.symbol ? 'text-black' : 'text-yellow-400'}`}>{curr.symbol}</span>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-tight">{curr.code}</p>
                                    <p className={`text-[8px] font-bold ${currentCurrency === curr.symbol ? 'text-black/60' : 'text-zinc-600'}`}>{curr.label}</p>
                                  </div>
                                </div>
                                {currentCurrency === curr.symbol && <span className="material-symbols-outlined text-sm">check_circle</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>


                {/* Designer Payout Information Section - Only for Designers */}
                {isDesigner && (
                  <div className="group relative mt-8 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 hover:border-yellow-400/20 transition-all duration-500 overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity z-10 text-yellow-400">
                      <span className="material-symbols-outlined text-7xl">payments</span>
                    </div>

                    <div className="relative z-20">
                      <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1">Payout Settlement</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Where you receive your earnings</p>
                      
                      <div className="mt-8 p-6 bg-yellow-400/5 rounded-xl border border-yellow-400/10 mb-8">
                        <p className="text-[10px] text-yellow-400/80 font-black leading-relaxed uppercase tracking-widest flex items-center gap-3">
                          <span className="material-symbols-outlined text-sm">info</span>
                          Manage your settlement protocols in the "Payment Method" tab to ensure synchronized global payouts.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('payment')}
                        className="w-full py-4 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-black text-white uppercase tracking-widest hover:border-yellow-400/50 transition-all flex items-center justify-center gap-3"
                      >
                        <span className="material-symbols-outlined text-sm">settings_suggest</span>
                        Configure Receiving Protocols
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Unified Payment Protocols Header */}
                <section className="space-y-4">
                  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-8 relative group shadow-xl">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-yellow-400 shadow-lg">
                          <span className="material-symbols-outlined">payments</span>
                        </div>
                        <div>
                          <h2 className="text-xl font-black tracking-tight text-white uppercase">Payment Protocols</h2>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select & Configure Gateways</p>
                        </div>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowGatewayDropdown(!showGatewayDropdown)}
                          className="flex items-center gap-3 px-6 py-3 bg-yellow-400 text-black rounded-lg font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">add_circle</span>
                          Add Protocol
                        </button>

                        {showGatewayDropdown && (
                          <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-[100] overflow-hidden p-3 backdrop-blur-3xl animate-in zoom-in-95 duration-200">
                            <div className="relative mb-3">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-500 text-sm">search</span>
                              <input
                                type="text"
                                placeholder="Search Protocols..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/40 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400/50 transition-all font-mono"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                              {/* Unified Search Results */}
                              {isDesigner ? (
                                // Designer Specific Methods
                                [
                                  { type: 'UPI (India)', icon: 'bolt', recommended: true },
                                  { type: 'Bank Account', icon: 'account_balance', recommended: true }
                                ]
                                  .filter(g =>
                                    g.type.toLowerCase().includes(searchQuery.toLowerCase()) &&
                                    !paymentMethods.some(pm => pm.type === g.type)
                                  )
                                  .map((g: any) => (
                                    <button
                                      key={g.type}
                                      type="button"
                                      onClick={() => addPaymentMethod(g.type)}
                                      className="w-full text-left px-4 py-3 hover:bg-yellow-400 hover:text-black rounded-lg transition-all flex items-center justify-between group"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-lg">{g.icon}</span>
                                        <p className="text-[10px] font-black uppercase tracking-tight">{g.type}</p>
                                      </div>
                                      <span className="text-[6px] font-black opacity-60 uppercase tracking-widest group-hover:text-black/60">Recommended</span>
                                    </button>
                                  ))
                              ) : (
                                // Organization Standard Methods
                                [
                                  { type: 'Binance', icon: 'currency_bitcoin', recommended: true },
                                  { type: 'Payoneer', icon: 'language', recommended: true },
                                  { type: 'PayPal', icon: 'payments', recommended: true },
                                  { type: 'Airtm', icon: 'cloud', recommended: true },
                                  { type: 'Bank Account', icon: 'account_balance', recommended: false },
                                  ...masterGateways.filter(g => !['Binance', 'Payoneer', 'PayPal', 'Airtm', 'Bank Account'].includes(g.type))
                                ]
                                  .filter(g =>
                                    g.type.toLowerCase().includes(searchQuery.toLowerCase()) &&
                                    !paymentMethods.some(pm => pm.type === g.type)
                                  )
                                  .map((g: any) => {
                                    const isRec = g.recommended === true || (g.recommended && (g.recommended.includes(countryCode) || g.recommended.includes('GLOBAL')));
                                    return (
                                      <button
                                        key={g.type}
                                        type="button"
                                        onClick={() => addPaymentMethod(g.type)}
                                        className="w-full text-left px-4 py-3 hover:bg-yellow-400 hover:text-black rounded-lg transition-all flex items-center justify-between group"
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className="material-symbols-outlined text-lg">
                                            {g.icon || (g.type === 'Stripe' ? 'credit_card' : 'account_balance_wallet')}
                                          </span>
                                          <p className="text-[10px] font-black uppercase tracking-tight">{g.type}</p>
                                        </div>
                                        {isRec && <span className="text-[6px] font-black opacity-60 uppercase tracking-widest group-hover:text-black/60">Recommended</span>}
                                      </button>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Methods List */}
                  <div className="grid grid-cols-1 gap-6">
                    {paymentMethods.length === 0 && (
                      <div className="bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl p-12 text-center">
                        <span className="material-symbols-outlined text-zinc-700 text-5xl mb-4">account_balance_wallet</span>
                        <p className="text-[12px] font-bold text-zinc-500 uppercase tracking-[0.2em]">No Active Gateways</p>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-2">Add a gateway above to begin configuration</p>
                      </div>
                    )}
                    {paymentMethods.map((method) => {
                      const isBank = method.type.toLowerCase().includes('bank account');

                      return (
                        <div key={method.id} className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-8 relative group hover:border-yellow-400/20 transition-all">
                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => removePaymentMethod(method.id)}
                            className="absolute top-6 right-6 w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all z-20 shadow-lg"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>

                          <div className="flex flex-col md:flex-row gap-8">
                            <div className="w-16 h-16 bg-black border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 group-hover:text-yellow-400 transition-colors shrink-0">
                              <span className="material-symbols-outlined text-3xl">
                                {method.type === 'Binance' ? 'currency_bitcoin' :
                                  method.type === 'PayPal' ? 'payments' :
                                    method.type === 'Payoneer' ? 'language' :
                                      method.type.includes('UPI') ? 'bolt' :
                                        isBank ? 'account_balance' : 'account_balance_wallet'}
                              </span>
                            </div>
                            <div className="flex-1 space-y-6">
                              <div>
                                <label className="text-[10px] font-black text-white tracking-[0.2em] uppercase block mb-1">{method.type}</label>
                                <div className="flex gap-2">
                                  {method.type === 'PayPal' && <span className="text-[8px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded uppercase">Protocol Fee: +6%</span>}
                                  {method.type === 'Binance' && <span className="text-[8px] font-black bg-green-500/10 text-green-400 px-2 py-0.5 rounded uppercase">Protocol Fee: 0%</span>}
                                </div>
                              </div>

                              {isBank ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Account Holder</p>
                                    <input
                                      value={method.holder || ''}
                                      onChange={(e) => setPaymentMethods(paymentMethods.map(m => m.id === method.id ? { ...m, holder: e.target.value } : m))}
                                      className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                                      placeholder="Full Name"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Account Number</p>
                                    <input
                                      value={method.value || ''}
                                      onChange={(e) => updateMethodValue(method.id, e.target.value)}
                                      className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                                      placeholder="Account #"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">
                                      {method.type.includes('USA') ? 'Routing Number' :
                                        method.type.includes('UK') ? 'Sort Code / IBAN' :
                                          method.type.includes('Australia') ? 'BSB Code' :
                                            (method.type.includes('India') || isDesigner) ? 'IFSC Code' : 'Transit / Swift'}
                                    </p>
                                    <input
                                      value={method.routing || ''}
                                      onChange={(e) => setPaymentMethods(paymentMethods.map(m => m.id === method.id ? { ...m, routing: e.target.value } : m))}
                                      className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                                      placeholder={(method.type.includes('India') || isDesigner) ? 'IFSC Code (e.g. SBIN0...)' : 'Code'}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Bank Name</p>
                                    <input
                                      value={method.bankName || ''}
                                      onChange={(e) => setPaymentMethods(paymentMethods.map(m => m.id === method.id ? { ...m, bankName: e.target.value } : m))}
                                      className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                                      placeholder="Bank Name"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Settlement Address</p>
                                  <input
                                    value={method.value}
                                    onChange={(e) => updateMethodValue(method.id, e.target.value)}
                                    className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none transition-all"
                                    placeholder={method.type.includes('UPI') ? 'Enter UPI ID (e.g. name@bank)' : `Enter ${method.type} address...`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* Wallet & Rewards Tab */}
            {activeTab === 'wallet' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Points Mastercard */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity text-yellow-400">
                    <span className="material-symbols-outlined text-8xl">toll</span>
                  </div>

                  <div className="relative">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-2">Global Rewards Balance</p>
                    <h2 className="text-5xl font-black text-white flex items-baseline gap-3 tabular-nums uppercase tracking-tighter">
                      {pointsBalance.toLocaleString()}
                      <span className="text-xl text-yellow-400 font-bold tracking-tight">Points</span>
                    </h2>
                    <div className="mt-8 flex gap-4">
                      <div className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]" />
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Protocol Active</span>
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs text-yellow-400">shield</span>
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Secure Ledger</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Transfer Station */}
                  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
                        <span className="material-symbols-outlined">send</span>
                      </div>
                      <div>
                        <h4 className="text-[12px] font-black text-white uppercase tracking-widest">Transfer Station</h4>
                        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Pay others with Cadonce points</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Recipient Identity (Email)</label>
                        <input
                          value={transferEmail}
                          onChange={(e) => setTransferEmail(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 transition-all"
                          placeholder="user@example.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Transfer Amount</label>
                        <input
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 transition-all"
                          placeholder="0.00"
                          type="number"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isProcessingWallet || !transferEmail || !transferAmount}
                        onClick={async () => {
                          setIsProcessingWallet(true);
                          try {
                            const { transferPoints } = await import('@/app/actions');
                            const res = await transferPoints(transferEmail, parseInt(transferAmount));
                            if (res.success) {
                              setPointsBalance(res.newBalance || 0);
                              setNotification({ message: 'Points transferred successfully!', type: 'success' });
                              setTransferEmail('');
                              setTransferAmount('');
                            } else {
                              setNotification({ message: res.error || 'Transfer failed', type: 'error' });
                            }
                          } catch (err: any) {
                            setNotification({ message: err.message, type: 'error' });
                          } finally {
                            setIsProcessingWallet(false);
                          }
                        }}
                        className="w-full py-4 rounded-lg bg-yellow-400 text-black font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                      >
                        Initiate P2P Transfer
                      </button>
                    </div>
                  </div>

                  {/* Withdrawal Terminal */}
                  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-green-400">
                        <span className="material-symbols-outlined">account_balance</span>
                      </div>
                      <div>
                        <h4 className="text-[12px] font-black text-white uppercase tracking-widest">Withdrawal Terminal</h4>
                        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Convert points to cash</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Withdrawal Amount</label>
                        <input
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 transition-all"
                          placeholder="0.00"
                          type="number"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-1">Settlement Details (Bank/UPI)</label>
                        <textarea
                          value={bankDetails}
                          onChange={(e) => setBankDetails(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white font-semibold text-sm focus:border-yellow-400 transition-all resize-none h-24"
                          placeholder="Enter Bank details or UPI ID..."
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isProcessingWallet || !withdrawAmount || !bankDetails}
                        onClick={async () => {
                          setIsProcessingWallet(true);
                          try {
                            const { requestWithdrawal } = await import('@/app/actions');
                            const res = await requestWithdrawal(parseInt(withdrawAmount), { bankDetails });
                            if (res.success) {
                              setPointsBalance(res.newBalance || 0);
                              setNotification({ message: 'Withdrawal protocol initiated!', type: 'success' });
                              setWithdrawAmount('');
                              setBankDetails('');
                            } else {
                              setNotification({ message: res.error || 'Withdrawal failed', type: 'error' });
                            }
                          } catch (err: any) {
                            setNotification({ message: err.message, type: 'error' });
                          } finally {
                            setIsProcessingWallet(false);
                          }
                        }}
                        className="w-full py-4 rounded-lg bg-yellow-400 text-black font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                      >
                        Request Cash Conversion
                      </button>
                    </div>
                  </div>
                </div>

                {/* PROJECT ESCROW TERMINAL */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-400">
                        <span className="material-symbols-outlined">lock</span>
                      </div>
                      <div>
                        <h4 className="text-[12px] font-black text-white uppercase tracking-widest">Project Escrow Terminal</h4>
                        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Project funds currently held in platform trust</p>
                      </div>
                    </div>
                    <span className="px-4 py-1.5 rounded-lg bg-orange-400/10 border border-orange-400/20 text-[10px] font-black text-orange-400 uppercase tracking-widest">
                      {[...(organizationEscrows || []), ...(designerEscrows || [])].length} SECURED PROJECTS
                    </span>
                  </div>

                  <div className="space-y-4">
                    {[...(organizationEscrows || []), ...(designerEscrows || [])].length === 0 ? (
                      <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">No Active Escrows</p>
                      </div>
                    ) : (
                      [...(organizationEscrows || []), ...(designerEscrows || [])].map((escrow: any) => (
                        <div key={escrow.id} className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/30 flex items-center justify-between group hover:border-orange-400/30 transition-all duration-300">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-lg bg-black border border-zinc-800 flex items-center justify-center text-orange-400">
                              <span className="material-symbols-outlined">lock</span>
                            </div>
                            <div>
                              <div className="text-[12px] font-black text-white uppercase tracking-tight">Project #{escrow.project_id.slice(-6)}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={`w-2 h-2 rounded-full ${escrow.status === 'released' ? 'bg-green-400' : 'bg-orange-400 shadow-[0_0_10px_#fb923c]'}`} />
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{escrow.status === 'released' ? 'Funds Released' : 'Held in Escrow'}</div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-white">
                              {escrow.currency}{parseFloat(escrow.amount).toLocaleString()}
                            </div>
                            <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1">{new Date(escrow.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* TRANSACTION LEDGER */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-purple-400">
                      <span className="material-symbols-outlined">receipt_long</span>
                    </div>
                    <div>
                      <h4 className="text-[12px] font-black text-white uppercase tracking-widest">Rewards Ledger</h4>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Historical audit of your CADONCE points</p>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                    {ledger.length === 0 ? (
                      <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">No Transactions Logged</p>
                      </div>
                    ) : (
                      ledger.map((entry) => (
                        <div key={entry.id} className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/30 flex items-center justify-between group hover:border-purple-500/30 transition-all duration-300">
                          <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center border transition-all ${entry.amount > 0 ? 'bg-green-500/5 border-green-500/10 text-green-400' : 'bg-red-500/5 border-red-500/10 text-red-400'}`}>
                              <span className="material-symbols-outlined text-lg">
                                {entry.type === 'earn' ? 'auto_awesome' : entry.type === 'transfer' ? 'send' : 'payments'}
                              </span>
                            </div>
                            <div>
                              <div className="text-[12px] font-black text-white uppercase tracking-tight">{entry.description}</div>
                              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{entry.type}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-black ${entry.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}
                            </div>
                            <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1">{new Date(entry.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}


            {/* Danger Zone */}
            <div className="pt-12 mt-12 border-t border-red-500/10">
              <div className="bg-red-500/5 rounded-3xl p-8 border border-red-500/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-red-500">dangerous</span>
                </div>

                <h3 className="text-xl font-headline font-black text-red-400 uppercase tracking-tight mb-2">Danger Zone</h3>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-6">Irreversible Action: Permanently terminate your workstation access and purge all project data.</p>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">delete_forever</span>
                  Permanently Delete Account
                </button>
              </div>
            </div>
            {/* Global Save Action */}
            <div className="pt-8 pb-12 flex justify-end border-t border-zinc-800/30">
              <button
                type="submit"
                disabled={isSaving}
                className={`px-8 py-3 font-black uppercase italic tracking-tighter text-sm rounded shadow-lg transition-all ${isSaving
                    ? 'bg-yellow-400/20 text-yellow-400/40 cursor-wait'
                    : 'bg-yellow-400 text-black hover:brightness-110 active:scale-[0.98] shadow-yellow-400/20'
                  }`}
              >
                {isSaving ? 'Synchronizing...' : 'Commit Changes'}
              </button>
            </div>
          </form>
          </div>
          </div>
        </main>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowDeleteModal(false)} />
            <div className="relative w-full max-w-md bg-[#0c0a04] border border-red-500/30 rounded-[2.5rem] p-8 shadow-[0_0_100px_rgba(239,68,68,0.15)] animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 mb-6 mx-auto">
                <span className="material-symbols-outlined text-4xl">warning</span>
              </div>

              <h2 className="text-2xl font-headline font-black text-white text-center uppercase tracking-tight mb-2">Are you absolutely sure?</h2>
              <p className="text-[10px] text-neutral-500 font-bold text-center uppercase tracking-widest mb-8 leading-relaxed">
                This will permanently delete your account and ALL associated data (projects, clients, and workstation settings). This action cannot be undone.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest ml-1">Type "DELETE MY ACCOUNT" to confirm</label>
                  <input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white font-mono focus:ring-1 focus:ring-red-500 outline-none transition-all uppercase"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmText.toLowerCase() !== 'delete my account'}
                    className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isDeleting || deleteConfirmText.toLowerCase() !== 'delete my account'
                        ? 'bg-red-500/20 text-red-500/40 cursor-not-allowed'
                        : 'bg-red-500 text-white shadow-lg shadow-red-500/20 active:scale-95'
                      }`}
                  >
                    {isDeleting ? <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span> : 'Delete Permanently'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
