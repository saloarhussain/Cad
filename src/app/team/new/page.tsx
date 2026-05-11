"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { saveDesigner } from '@/app/actions';
import AuthGuard from '@/components/AuthGuard';
import { CountrySearch } from '@/components/CountrySearch';

export default function NewDesignerPage() {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = React.useState<'new' | 'registered'>('new');
  const [saving, setSaving] = React.useState(false);
  const [skills, setSkills] = React.useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = React.useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const addSkill = () => {
    if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
      setSkills([...skills, currentSkill.trim()]);
      setCurrentSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setSaving(true);
    
    const formData = new FormData(e.currentTarget);
    // Add skills as a JSON string
    formData.append('skills', JSON.stringify(skills));
    formData.append('onboardingMode', mode);

    try {
      const result = await saveDesigner(formData);
      if (result.success) {
        if (result.warning) {
          setNotification({ type: 'error', message: result.warning });
        } else {
          setNotification({ 
            type: 'success', 
            message: mode === 'registered' ? 'Invite sent successfully to the designer' : 'Designer onboarded successfully' 
          });
          // Delay redirect only on full success
          setTimeout(() => {
            window.location.href = '/team';
          }, 2000);
        }
      } else {
        setNotification({ type: 'error', message: result.error || 'Failed to save designer.' });
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setNotification({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="bg-background text-on-background font-body min-h-screen flex flex-col items-center pb-32">
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#7b7767]/80 backdrop-blur-xl dark:bg-[#1a1a1a]/80 shadow-[0_0_15px_rgba(252,224,3,0.12)]">
          <div className="flex justify-between items-center w-full px-6 py-4 max-w-full">
            <div className="flex items-center gap-4">
              <Link href="/team" className="text-[#fce003] active:scale-95 duration-200 hover:bg-[#fce003]/10 p-2 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">arrow_back</span>
              </Link>
              <h1 className="font-['Plus_Jakarta_Sans'] font-bold tracking-tight text-xl text-[#fce003]">
                {mode === 'new' ? 'New Designer' : 'Hire Registered Designer'}
              </h1>
            </div>
          </div>
        </header>

        {/* Success/Error Notification */}
        {notification && (
          <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            <span className="material-symbols-outlined">{notification.type === 'success' ? 'check_circle' : 'error'}</span>
            <span className="text-[11px] font-black uppercase tracking-widest">{notification.message}</span>
          </div>
        )}
        
        <main className="w-full max-w-md px-6 pt-24 flex-grow">
          <div className="mb-8">
            <p className="font-['Inter'] text-[10px] uppercase font-bold tracking-[0.2em] text-on-surface-variant mb-4">Talent Acquisition Protocol</p>
            
            {/* Mode Selector */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 mb-8">
              <button 
                onClick={() => setMode('new')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'new' ? 'bg-[#fce003] text-black shadow-lg shadow-yellow-400/10' : 'text-white/40 hover:text-white'}`}
              >
                New Designer
              </button>
              <button 
                onClick={() => setMode('registered')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'registered' ? 'bg-[#fce003] text-black shadow-lg shadow-yellow-400/10' : 'text-white/40 hover:text-white'}`}
              >
                Registered
              </button>
            </div>

            <h2 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold tracking-tighter text-white">
              {mode === 'new' ? 'Onboard New Talent' : 'Quick Hire Protocol'}
            </h2>
            <p className="text-white/40 text-[11px] mt-2 leading-relaxed">
              {mode === 'new' 
                ? 'Create a full profile for a designer new to the CADONCE ecosystem.' 
                : 'Instantly hire a designer who is already registered on the platform.'}
            </p>
            <div className="h-1 w-12 bg-[#fce003] mt-6 rounded-full"></div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'new' && (
              <>
                <div className="group">
                  <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Full Name</label>
                  <div className="relative bg-surface-container-lowest rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-outline-variant transition-all duration-300">
                    <input name="fullName" required className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-outline/50" placeholder="e.g. Julian Vesta" type="text"/>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                      <span className="material-symbols-outlined text-sm">person</span>
                    </div>
                  </div>
                </div>
                
                <div className="group">
                  <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Specialization</label>
                  <div className="relative bg-surface-container-lowest rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-outline-variant transition-all duration-300">
                    <input name="specialty" className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-outline/50" placeholder="e.g. Matrix Jewelry Expert" type="text"/>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                      <span className="material-symbols-outlined text-sm">workspace_premium</span>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Professional Skills</label>
                  <div className="relative bg-surface-container-lowest rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-outline-variant transition-all duration-300">
                    <input 
                      value={currentSkill}
                      onChange={(e) => setCurrentSkill(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                      className="w-full bg-transparent border-none focus:ring-0 text-white pl-4 pr-20 py-3 placeholder:text-outline/50" 
                      placeholder="e.g. Matrix, Rhino, CAD" 
                      type="text"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={addSkill}
                        className="bg-[#fce003] w-8 h-8 rounded flex items-center justify-center text-black shadow-lg active:scale-95 transition-transform"
                      >
                        <span className="material-symbols-outlined font-bold text-lg">add</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {skills.map(skill => (
                      <span key={skill} className="flex items-center gap-2 px-3 py-1 bg-yellow-400/10 border border-yellow-400/20 rounded-full text-[10px] font-bold text-yellow-400 uppercase tracking-wider group">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} className="hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[10px]">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="group">
                  <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Experience Level</label>
                  <div className="relative bg-surface-container-lowest rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-outline-variant transition-all duration-300">
                    <input name="experience" required className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-outline/50" placeholder="e.g. 5+ Years" type="text"/>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                      <span className="material-symbols-outlined text-sm">history_edu</span>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Mobile Number</label>
                  <div className="relative bg-surface-container-lowest rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-outline-variant transition-all duration-300">
                    <input name="mobile" required className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-outline/50" placeholder="+1 (555) 000-0000" type="tel"/>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                      <span className="material-symbols-outlined text-sm">call</span>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Country</label>
                  <CountrySearch name="country" required defaultValue="United States of America" />
                </div>
              </>
            )}

            {/* Common Fields */}
            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Email Address</label>
              <div className="relative bg-surface-container-lowest rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-outline-variant transition-all duration-300">
                <input name="email" required className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-outline/50" placeholder="julian@cadonce.com" type="email"/>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                  <span className="material-symbols-outlined text-sm">mail</span>
                </div>
              </div>
            </div>
            
            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Employment Mode</label>
              <div className="relative bg-surface-container-lowest rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-outline-variant transition-all duration-300">
                <select name="employmentType" required defaultValue="Freelancer" className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 appearance-none cursor-pointer font-medium">
                  <option className="bg-surface text-white" value="In-House">🏢 In-House</option>
                  <option className="bg-surface text-white" value="Freelancer">🌐 Freelancer</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>
            </div>

            {mode === 'new' && (
              <div className="group">
                <div className="flex justify-between items-center mb-2">
                  <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant uppercase">Initial Performance</label>
                  <span className="text-[#fce003] font-black text-sm">90%</span>
                </div>
                <input name="performance" type="range" min="0" max="100" defaultValue="90" className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fce003]" />
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#fce003]/5 border border-[#fce003]/10">
               <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-[#fce003] uppercase tracking-widest">Portal Access</span>
                     <span className="text-[9px] text-outline font-medium max-w-[180px]">Automatically generate 3D workstation credentials.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="hasPortalAccess" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#fce003]"></div>
                  </label>
               </div>
            </div>
            
            <div className="mt-10">
              <button type="submit" disabled={saving} className="w-full py-4 rounded-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(252,224,3,0.3)] bg-gradient-to-r from-[#fce003] via-[#ff8c00] to-[#ff0000] disabled:opacity-60">
                <span className="font-['Plus_Jakarta_Sans'] font-black tracking-widest text-black text-sm uppercase">
                  {saving ? 'Processing...' : mode === 'new' ? 'Save Designer' : 'Hiring Designer'}
                </span>
                <span className="material-symbols-outlined text-black">{saving ? 'hourglass_top' : 'send'}</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </AuthGuard>
  );
}

