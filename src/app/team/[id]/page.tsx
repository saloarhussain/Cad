"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getDb } from '@/app/actions';
import Avatar from '@/components/Avatar';

export default function DesignerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [designer, setDesigner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [currentSkill, setCurrentSkill] = useState('');

  useEffect(() => {
    const fetchDesigner = async () => {
      const db = await getDb();
      const designers = db.designers || [];
      const found = designers.find((d: any) => d.id === params.id);
      
      if (found) {
        setDesigner(found);
        setEditData(found);
      } else {
        setDesigner(null);
      }
      setLoading(false);
    };
    fetchDesigner();
  }, [params.id]);

  const addSkill = () => {
    const trimmedSkill = currentSkill.trim();
    if (trimmedSkill) {
      const currentSkills = Array.isArray(editData.skills) ? editData.skills : [];
      if (!currentSkills.includes(trimmedSkill)) {
        setEditData({
          ...editData,
          skills: [...currentSkills, trimmedSkill]
        });
        setCurrentSkill('');
      }
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setEditData({
      ...editData,
      skills: editData.skills.filter((s: string) => s !== skillToRemove)
    });
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this designer? This will remove them from the team matrix.')) {
      const { deleteDesigner } = await import('@/app/actions');
      const res = await deleteDesigner(params.id as string);
      if (res.success) {
        router.push('/team');
      } else {
        alert(res.error || 'Failed to delete designer.');
      }
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const { updateDesigner } = await import('@/app/actions');
      const res = await updateDesigner(params.id as string, editData);
      if (res.success) {
        setDesigner(editData);
        setIsEditing(false);
      } else {
        alert(res.error || 'Failed to update designer.');
      }
    } catch (err) {
      alert('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!designer) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-headline font-bold text-white mb-4">Designer Not Found</h2>
        <Link href="/team" className="text-primary-fixed-dim hover:underline">Return to Team Matrix</Link>
      </div>
    );
  }

  return (
    <div className="bg-[#161308] text-on-background font-body min-h-screen">
      {/* Main Dossier Content */}
      <main className={`${isEditing ? 'pt-44' : 'pt-32'} pb-32`}>
        {!isEditing ? (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Left Column: Identity Card */}
              <div className="lg:col-span-1 space-y-6 px-6 lg:px-0">
                <div className="relative bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 text-center overflow-hidden shadow-2xl group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#fce003] to-transparent opacity-30"></div>
                  
                  <div className="relative mb-6 mx-auto w-32 h-32">
                    <div className="absolute inset-0 bg-[#fce003]/20 rounded-full blur-2xl group-hover:bg-[#fce003]/40 transition-all duration-700"></div>
                    <Avatar
                      email={designer.email}
                      name={designer.fullName}
                      size={128}
                      className="relative w-full h-full rounded-3xl object-cover ring-1 ring-white/10 group-hover:ring-[#fce003]/50 transition-all shadow-2xl"
                    />
                    <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-2xl border-4 border-[#161308] shadow-xl flex items-center justify-center ${designer.hasPortalAccess ? 'bg-green-500' : 'bg-neutral-600'}`}>
                      <span className="material-symbols-outlined text-white text-[14px] font-black">
                        {designer.hasPortalAccess ? 'verified_user' : 'lock'}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">{designer.fullName}</h2>
                  <p className="text-[#fce003]/60 text-[9px] font-black uppercase tracking-[0.25em] mt-2">{designer.specialty}</p>
                  
                  <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Performance Protocol</p>
                      <p className="text-xs font-black text-[#fce003]">{designer.performance}%</p>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-[#fce003] rounded-full shadow-[0_0_15px_rgba(252,224,3,0.3)]"
                        style={{ width: `${designer.performance}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Portal Access Brief */}
                <div className={`p-6 rounded-[2rem] border transition-all ${designer.hasPortalAccess ? 'bg-[#fce003]/5 border-[#fce003]/20' : 'bg-white/[0.02] border-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[7px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-1">Access Tier</p>
                      <h3 className={`text-[10px] font-black uppercase tracking-widest ${designer.hasPortalAccess ? 'text-[#fce003]' : 'text-neutral-400'}`}>
                        {designer.hasPortalAccess ? 'Active Workstation' : 'Restricted Access'}
                      </h3>
                    </div>
                    {designer.hasPortalAccess && (
                      <button 
                        onClick={async () => {
                          const { resendDesignerInvite } = await import('@/app/actions');
                          const res = await resendDesignerInvite(params.id as string);
                          if (res.success) {
                            if (res.warning) {
                              alert(res.warning);
                            } else {
                              alert('Invitation resent successfully!');
                            }
                          } else {
                            alert(res.error || 'Failed to resend invitation');
                          }
                        }}
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white hover:text-[#fce003] hover:border-[#fce003]/50 transition-all flex items-center justify-center active:scale-90"
                      >
                        <span className="material-symbols-outlined text-lg">forward_to_inbox</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Detailed Dossier */}
              <div className="lg:col-span-2 px-6 lg:px-0 h-full">
                <div className="relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl h-full group">
                  
                  {/* Integrated Tactical Controls (Dedicated Row - Permanently Visible) */}
                  {!isEditing && (
                    <div className="flex justify-between items-center mb-8 relative z-30">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-[#fce003] rounded-full animate-pulse"></div>
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Personnel Node: Secure</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setIsEditing(true)} 
                          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-[#fce003] flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 shadow-lg"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button 
                          onClick={handleDelete} 
                          className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white active:scale-90 transition-all flex items-center justify-center shadow-lg"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-[#fce003] uppercase tracking-[0.2em]">Contact Vector</p>
                      <p className="text-white font-bold text-sm">{designer.email}</p>
                      <p className="text-neutral-500 text-[10px] font-medium mt-1">{designer.mobile}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-[#fce003] uppercase tracking-[0.2em]">Geographic Node</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{designer.country?.toLowerCase() === 'us' ? '🇺🇸' : designer.country?.toLowerCase() === 'uk' ? '🇬🇧' : designer.country?.toLowerCase() === 'in' ? '🇮🇳' : designer.country?.toLowerCase() === 'bd' ? '🇧🇩' : designer.country?.toLowerCase() === 'pk' ? '🇵🇰' : designer.country?.toLowerCase() === 'tr' ? '🇹🇷' : designer.country?.toLowerCase() === 'vn' ? '🇻🇳' : '🌍'}</span>
                        <p className="text-white font-bold text-sm uppercase tracking-widest">
                          {designer.country === 'in' ? 'India' : designer.country === 'us' ? 'USA' : designer.country === 'uk' ? 'UK' : designer.country}
                        </p>
                      </div>
                      <p className="text-neutral-500 text-[10px] font-medium mt-1">Satellite Deployment</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-[#fce003] uppercase tracking-[0.2em]">Staffing Classification</p>
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-sm ${designer.employmentType === 'In-House' ? 'text-white/40' : 'text-[#fce003]'}`}>{designer.employmentType === 'In-House' ? 'domain' : 'public'}</span>
                        <p className={`font-bold text-sm uppercase tracking-widest ${designer.employmentType === 'In-House' ? 'text-white/60' : 'text-white'}`}>
                          {designer.employmentType || 'Freelancer'}
                        </p>
                      </div>
                      <p className="text-neutral-500 text-[10px] font-medium mt-1">Employment Model</p>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <p className="text-[8px] font-black text-[#fce003] uppercase tracking-[0.2em]">Talent Bio & Experience</p>
                      <p className="text-white/80 font-medium text-sm leading-relaxed max-w-lg italic">
                        Certified {designer.specialty} with {designer.experience || 'extensive production'} history. Integrated within the CADONCE global delivery matrix.
                      </p>
                    </div>

                    <div className="space-y-4 md:col-span-2">
                      <p className="text-[8px] font-black text-[#fce003] uppercase tracking-[0.2em]">Skill Matrix</p>
                      <div className="flex flex-wrap gap-2">
                        {designer.skills?.map((skill: string) => (
                          <span key={skill} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-white/60 uppercase tracking-widest hover:border-[#fce003]/50 hover:text-[#fce003] transition-all cursor-default">
                            {skill}
                          </span>
                        )) || <p className="text-neutral-500 text-xs italic">Skill matrix pending initialization...</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* EDIT MODE: Cinematic Onboarding Layout */
          <div className="max-w-2xl mx-auto px-6 space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="font-['Inter'] text-[10px] uppercase font-bold tracking-[0.2em] text-[#fce003] mb-2">Designer Editor</p>
                <h2 className="font-headline text-3xl font-extrabold tracking-tighter text-white">Modify Professional Data</h2>
                <div className="h-1 w-12 bg-[#fce003] mt-4 rounded-full"></div>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Full Name</label>
              <div className="relative bg-white/5 rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-white/10 transition-all duration-300">
                <input 
                  value={editData.fullName}
                  onChange={(e) => setEditData({...editData, fullName: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3" 
                  type="text"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                  <span className="material-symbols-outlined text-sm">person</span>
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Professional Skills</label>
              <div className="relative bg-white/5 rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-white/10 transition-all duration-300">
                <input 
                  value={currentSkill}
                  onChange={(e) => setCurrentSkill(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                  className="w-full bg-transparent border-none focus:ring-0 text-white pl-4 pr-20 py-3 placeholder:text-outline/50" 
                  placeholder="Add skills..." 
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
                {(Array.isArray(editData.skills) ? editData.skills : [])?.map((skill: string) => (
                  <span key={skill} className="flex items-center gap-2 px-3 py-1 bg-yellow-400/10 border border-yellow-400/20 rounded-full text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
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
              <div className="relative bg-white/5 rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-white/10 transition-all duration-300">
                <input 
                  value={editData.experience || ''}
                  onChange={(e) => setEditData({...editData, experience: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3" 
                  type="text"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                  <span className="material-symbols-outlined text-sm">history_edu</span>
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Email Address</label>
              <div className="relative bg-white/5 rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-white/10 transition-all duration-300">
                <input 
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({...editData, email: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3" 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                  <span className="material-symbols-outlined text-sm">mail</span>
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Mobile Number</label>
              <div className="relative bg-white/5 rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-white/10 transition-all duration-300">
                <input 
                  type="tel"
                  value={editData.mobile}
                  onChange={(e) => setEditData({...editData, mobile: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3" 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-[#fce003] transition-colors">
                  <span className="material-symbols-outlined text-sm">call</span>
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Employment Type</label>
              <div className="relative bg-white/5 rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-white/10 transition-all duration-300">
                <select 
                  value={editData.employmentType || 'Freelancer'}
                  onChange={(e) => setEditData({...editData, employmentType: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 appearance-none cursor-pointer"
                >
                  <option className="bg-neutral-900" value="In-House">🏢 In-House</option>
                  <option className="bg-neutral-900" value="Freelancer">🌐 Freelancer</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-outline group-focus-within:text-[#fce003]">
                  <span className="material-symbols-outlined text-sm transition-colors">expand_more</span>
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant mb-2 uppercase">Country</label>
              <div className="relative bg-white/5 rounded-lg focus-within:shadow-[0_0_15px_rgba(252,224,3,0.25)] focus-within:border-[#fce003] border border-white/10 transition-all duration-300">
                <select 
                  value={editData.country}
                  onChange={(e) => setEditData({...editData, country: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 appearance-none cursor-pointer"
                >
                  <option className="bg-neutral-900" value="in">🇮🇳 India</option>
                  <option className="bg-neutral-900" value="us">🇺🇸 USA</option>
                  <option className="bg-neutral-900" value="uk">🇬🇧 UK</option>
                  <option className="bg-neutral-900" value="cn">🇨🇳 China</option>
                  <option className="bg-neutral-900" value="bd">🇧🇩 Bangladesh</option>
                  <option className="bg-neutral-900" value="pk">🇵🇰 Pakistan</option>
                  <option className="bg-neutral-900" value="tr">🇹🇷 Turkey</option>
                  <option className="bg-neutral-900" value="vn">🇻🇳 Vietnam</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline group-focus-within:text-[#fce003]">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>
            </div>

            <div className="group">
              <div className="flex justify-between items-center mb-3">
                <label className="block font-['Inter'] text-xs font-medium tracking-wide text-on-surface-variant uppercase">Current Performance</label>
                <span className="text-[#fce003] font-black text-sm">{editData.performance}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={editData.performance}
                onChange={(e) => setEditData({...editData, performance: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fce003]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#fce003]/5 border border-[#fce003]/10">
               <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-[#fce003] uppercase tracking-widest">Portal Access</span>
                     <span className="text-[9px] text-outline font-medium">Toggle 3D Workstation Entry</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={editData.hasPortalAccess}
                      onChange={(e) => setEditData({...editData, hasPortalAccess: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#fce003]"></div>
                  </label>
               </div>
            </div>

             <div className="pt-10 space-y-4">
                <button 
                  disabled={saving}
                  onClick={handleUpdate}
                  className="w-full py-4 rounded-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(252,224,3,0.3)] bg-gradient-to-r from-[#fce003] via-[#ff8c00] to-[#ff0000] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="font-['Plus_Jakarta_Sans'] font-black tracking-widest text-black text-sm uppercase">{saving ? 'SAVING...' : 'SYNC INTELLIGENCE DATA'}</span>
                  <span className="material-symbols-outlined text-black" style={{ fontVariationSettings: "'FILL' 1" }}>{saving ? 'hourglass_top' : 'send'}</span>
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="w-full py-3 text-white/30 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-colors"
                >
                  Discard Changes
                </button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
