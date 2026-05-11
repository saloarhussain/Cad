"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getDb } from '@/app/actions';
import Avatar from '@/components/Avatar';
import { CountrySearch } from '@/components/CountrySearch';

export default function ClientDossierPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    mobile: '',
    country: '',
    platform: ''
  });

  useEffect(() => {
    const fetchClient = async () => {
      const db = await import('@/app/actions').then(mod => mod.getDb());
      const clients = db.clients || [];
      const found = clients.find((c: any) => c.id === params.id);
      
      if (found) {
        setClient(found);
        setFormData({
          name: found.name || '',
          companyName: found.companyName || '',
          email: found.email || '',
          mobile: found.mobile || '',
          country: found.country || '',
          platform: found.platform || ''
        });
      } else {
        setClient(null);
      }
      setLoading(false);
    };
    fetchClient();
  }, [params.id]);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this client record? This will permanently remove them from the Intelligence Matrix.')) {
      const { deleteClient } = await import('@/app/actions');
      const res = await deleteClient(params.id as string);
      if (res.success) {
        router.push('/clients');
      } else {
        alert('Failed to delete client record.');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { updateClient } = await import('@/app/actions');
    const result = await updateClient(params.id as string, formData);
    if (result.success) {
      setIsEditing(false);
      // Refresh local state
      setClient({ ...client, ...formData });
    } else {
      alert('Failed to save changes');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-headline font-bold text-white mb-4">Client Not Found</h2>
        <Link href="/clients" className="text-primary-fixed-dim hover:underline">Return to Client Matrix</Link>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface font-body min-h-screen">
      
      <main className="max-w-2xl mx-auto px-6 pt-44 pb-32 space-y-10">
        {/* Visual Accent Header with Avatar */}
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#fce003]/20 rounded-3xl blur-2xl"></div>
              <Avatar
                email={client.email}
                name={client.companyName || client.name}
                size={80}
                className="relative w-20 h-20 rounded-3xl ring-2 ring-white/10 flex-shrink-0 object-cover shadow-2xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-[2px] w-10 bg-gradient-to-r from-[#fce003] to-orange-600"></div>
                <span className="font-label text-[9px] font-black tracking-[0.3em] text-[#fce003] uppercase">Customer Intelligence</span>
              </div>
              <h2 className="font-headline text-3xl font-black text-white tracking-tighter italic uppercase">{client.companyName || client.name}</h2>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">{client.email}</p>
            </div>
          </div>
          <p className="text-white/60 text-sm max-w-lg text-left italic font-medium leading-relaxed">
            Comprehensive profile data for {formData.companyName || formData.name}. Tactical records are synced across the secure network.
          </p>
        </div>

        {/* Form Section */}
        <div className="bg-surface-container-low p-8 rounded-xl space-y-8 relative overflow-hidden text-left shadow-2xl">
          
          {/* Integrated Tactical Controls (Dedicated Row - No Overlay) */}
          {!isEditing && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-30">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#fce003] rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Registry Node: Secure</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 text-[#fce003] flex items-center justify-center hover:bg-[#fce003]/10 hover:border-[#fce003]/30 transition-all active:scale-90 shadow-xl"
                  title="Edit Dossier"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button 
                  onClick={() => {
                    const baseUrl = window.location.origin;
                    const link = `${baseUrl}/projects/request?clientId=${client.id}&clientName=${encodeURIComponent(client.companyName || client.name)}`;
                    navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }} 
                  className={`flex-1 sm:flex-none h-12 sm:h-10 px-4 sm:px-6 rounded-xl border flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl relative overflow-hidden group ${copied ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-[#fce003] border-[#fce003] text-black hover:brightness-110'}`}
                >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="material-symbols-outlined text-base relative z-10">{copied ? 'check_circle' : 'share'}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest relative z-10 whitespace-nowrap">
                    {copied ? 'COPIED' : 'SEND INTAKE'}
                  </span>
                </button>
                <button 
                  onClick={handleDelete} 
                  className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/40 hover:bg-red-500 hover:text-white hover:border-red-500 active:scale-90 transition-all flex items-center justify-center shadow-xl group"
                  title="Delete Client"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          )}

          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#fce003]/5 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="space-y-6 relative z-10">
            {/* Customer Name */}
            <div className="group">
              <label className="block font-label text-xs font-bold text-on-secondary-container uppercase tracking-widest mb-3">Customer Name</label>
              <div className="relative">
                <input 
                  disabled={!isEditing}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full bg-surface-container-lowest border rounded-lg py-4 px-5 text-on-surface placeholder:text-neutral-500 transition-all duration-300 outline-none ${isEditing ? 'border-[#fce003]/50 focus:border-[#fce003]' : 'border-white/5 cursor-default'}`} 
                  type="text" 
                />
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined transition-colors ${isEditing ? 'text-[#fce003]' : 'text-neutral-600'}`}>person</span>
              </div>
            </div>

            {/* Company Name */}
            <div className="group">
              <label className="block font-label text-xs font-bold text-on-secondary-container uppercase tracking-widest mb-3">Company Name</label>
              <div className="relative">
                <input 
                  disabled={!isEditing}
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  className={`w-full bg-surface-container-lowest border rounded-lg py-4 px-5 text-on-surface placeholder:text-neutral-500 transition-all duration-300 outline-none ${isEditing ? 'border-[#fce003]/50 focus:border-[#fce003]' : 'border-white/5 cursor-default'}`} 
                  type="text" 
                />
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined transition-colors ${isEditing ? 'text-[#fce003]' : 'text-neutral-600'}`}>business</span>
              </div>
            </div>

            {/* Contact Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="block font-label text-xs font-bold text-on-secondary-container uppercase tracking-widest mb-3">Email Address</label>
                <div className="relative">
                  <input 
                    disabled={!isEditing}
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={`w-full bg-surface-container-lowest border rounded-lg py-4 px-5 text-on-surface placeholder:text-neutral-500 transition-all duration-300 outline-none ${isEditing ? 'border-[#fce003]/50 focus:border-[#fce003]' : 'border-white/5 cursor-default'}`} 
                    type="email" 
                  />
                  <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined transition-colors ${isEditing ? 'text-[#fce003]' : 'text-neutral-600'}`}>mail</span>
                </div>
              </div>
              <div className="group">
                <label className="block font-label text-xs font-bold text-on-secondary-container uppercase tracking-widest mb-3">Mobile Number</label>
                <div className="relative">
                  <input 
                    disabled={!isEditing}
                    value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                    className={`w-full bg-surface-container-lowest border rounded-lg py-4 px-5 text-on-surface placeholder:text-neutral-500 transition-all duration-300 outline-none ${isEditing ? 'border-[#fce003]/50 focus:border-[#fce003]' : 'border-white/5 cursor-default'}`} 
                    type="tel" 
                  />
                  <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined transition-colors ${isEditing ? 'text-[#fce003]' : 'text-neutral-600'}`}>smartphone</span>
                </div>
              </div>
            </div>

            {/* Localization & Source */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="block font-label text-xs font-bold text-on-secondary-container uppercase tracking-widest mb-3">Country</label>
                {isEditing ? (
                  <CountrySearch 
                    name="country" 
                    defaultValue={formData.country} 
                    required 
                  />
                ) : (
                  <div className="w-full bg-surface-container-lowest border border-white/5 rounded-lg py-4 px-5 text-on-surface flex items-center justify-between">
                    <span className="font-medium">{formData.country || 'Global'}</span>
                    <span className="material-symbols-outlined text-neutral-600">public</span>
                  </div>
                )}
              </div>
              <div className="group">
                <label className="block font-label text-xs font-bold text-on-secondary-container uppercase tracking-widest mb-3">Platform/Source</label>
                <div className="relative">
                  <select 
                    disabled={!isEditing}
                    value={formData.platform}
                    onChange={(e) => setFormData({...formData, platform: e.target.value})}
                    className={`w-full bg-surface-container-lowest border rounded-lg py-4 px-5 text-on-surface appearance-none transition-all duration-300 outline-none ${isEditing ? 'border-[#fce003]/50 focus:border-[#fce003]' : 'border-white/5 cursor-default'}`}
                  >
                    <option value="Direct Referral">Direct Referral</option>
                    <option value="Upwork">Upwork</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Fiverr">Fiverr</option>
                  </select>
                  <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none transition-colors ${isEditing ? 'text-[#fce003]' : 'text-neutral-600'}`}>hub</span>
                </div>
              </div>
            </div>

            {/* Save Button (Edit Mode Only) */}
            {isEditing && (
              <div className="pt-8 flex flex-col gap-4">
                <button 
                  disabled={saving}
                  onClick={handleSave}
                  className="w-full bg-[#fce003] py-4 rounded-lg text-black font-headline font-bold uppercase tracking-widest text-sm shadow-lg active:scale-[0.98] transition-all hover:brightness-110 flex items-center justify-center gap-3"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">save</span>
                      SYNC DATA
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="w-full bg-white/5 py-4 rounded-lg text-white/40 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-all"
                >
                  CANCEL CHANGES
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
