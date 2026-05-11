"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { getDb } from '@/app/actions';
import Avatar from '@/components/Avatar';
import AuthGuard from '@/components/AuthGuard';
import { utils, writeFile } from 'xlsx';

const initialMockDesigners: any[] = [];

export default function TeamPage() {
  const [realDesigners, setRealDesigners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('none'); 
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedSkill, setSelectedSkill] = useState('All');
  const [employmentFilter, setEmploymentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const db = await getDb();
        if (db.designers) {
          // Map DB fields to component fields
          const formatted = db.designers.map((d: any) => ({
            ...d,
            name: d.fullName || 'Anonymous Designer',
            role: d.specialty || 'Professional Designer',
            experience: d.experience || (Math.floor(Math.random() * 5) + 3) + ' Years Exp',
            lastJob: db.projects?.find((p: any) => 
              d.fullName && (p.designer === d.fullName || p.designer === d.fullName.split(' ')[0])
            ),
            performance: d.performance || 90, 
            tags: d.skills || [d.specialty || 'CAD', 'Designer'],
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0u8M2vSRdnjPNptfjInHTEY5TvkihgUF6SKjJ87EvcwfpbMSr_W5LvRDBdPFG-DgM_oTOxLkPAbIa5nvfGQIY55GbGySSmpBXcIdTR87BgFcBudRfHn_VIHpz5uKc2MuH0KDF3TTALBR_1qbPPXzyzRwAlLqEJ8DaMzjXeMYcWoUXx1Gw2x224dJRZ9aafiAtvylny_16Qz0R_wSTJkDAXrlWeemFmEuq6Q9eUJRfZbrmOM2YDhJLvkm-9dWqk89MIS2fG8MMYwg',
            flag: d.country === 'us' ? '🇺🇸' : d.country === 'in' ? '🇮🇳' : d.country === 'uk' ? '🇬🇧' : '🌍',
            location: d.country?.toUpperCase() || 'GLOBAL'
          }));
          setRealDesigners(formatted);
        }
      } catch (err) {
        console.error('Error fetching team data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const allDesigners = useMemo(() => [...initialMockDesigners, ...realDesigners], [realDesigners]);

  const countries = useMemo(() => ['All', ...new Set(allDesigners.map(d => d.location))], [allDesigners]);
  const skills = useMemo(() => ['All', ...new Set(allDesigners.flatMap(d => d.tags))], [allDesigners]);

  const filteredDesigners = useMemo(() => {
    let result = allDesigners.filter(designer => {
      const matchesSearch = designer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          designer.role?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCountry = selectedCountry === 'All' || designer.location === selectedCountry;
      const matchesSkill = selectedSkill === 'All' || designer.tags.includes(selectedSkill);
      const matchesEmployment = employmentFilter === 'all' || (designer.employmentType || 'Freelancer') === employmentFilter;
      
      return matchesSearch && matchesCountry && matchesSkill && matchesEmployment;
    });

    if (sortOrder === 'performance') {
      result.sort((a, b) => b.performance - a.performance);
    } else if (sortOrder === 'role') {
      result.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
    }

    return result;
  }, [allDesigners, searchQuery, sortOrder, selectedCountry, selectedSkill, employmentFilter]);

  const handleExport = () => {
    const dataToExport = filteredDesigners.map(designer => ({
      'Full Name': designer.name,
      'Specialty': designer.role,
      'Email': designer.email,
      'Mobile': designer.mobile,
      'Country': designer.location,
      'Experience': designer.experience,
      'Employment Type': designer.employmentType || 'Freelancer',
      'Performance (%)': designer.performance,
      'Skills': designer.tags?.join(', ') || 'N/A',
      'Created At': designer.createdAt ? new Date(designer.createdAt).toLocaleDateString() : 'N/A'
    }));

    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Team");
    
    // Set column widths
    const wscols = [
      { wch: 25 }, // Name
      { wch: 25 }, // Specialty
      { wch: 30 }, // Email
      { wch: 20 }, // Mobile
      { wch: 15 }, // Country
      { wch: 15 }, // Experience
      { wch: 15 }, // Type
      { wch: 15 }, // Performance
      { wch: 40 }, // Skills
      { wch: 15 }  // Date
    ];
    worksheet['!cols'] = wscols;

    writeFile(workbook, `CADONCE_Team_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <AuthGuard>
      {isLoading ? (
        <div className="min-h-screen bg-[#161308] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-[#fce003] uppercase tracking-[0.3em] animate-pulse">Initializing Studio...</span>
          </div>
        </div>
      ) : (
        <>
          <main className="pb-32 px-6 max-w-7xl mx-auto pt-20">
        {/* Enhanced Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div>
            <h2 className="font-headline text-2xl font-black tracking-tight text-white uppercase italic">
              Team <span className="text-[#fce003]">Intelligence</span>
            </h2>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Global workforce deployment & productivity</p>
          </div>
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full md:w-auto">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Active Talent</p>
              <p className="text-sm font-black text-white">{allDesigners.length}</p>
            </div>
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Avg Performance</p>
              <p className="text-sm font-black text-[#fce003]">
                {Math.round(allDesigners.reduce((acc, d) => acc + (d.performance || 0), 0) / (allDesigners.length || 1))}%
              </p>
            </div>
            <div className="hidden sm:block px-4 py-2 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
              <p className="text-[7px] font-black text-yellow-400 uppercase tracking-widest mb-0.5">Deployment</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-[8px] font-black text-white uppercase">Operational</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-[#fce003] transition-colors">search</span>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white placeholder:text-neutral-600 focus:bg-white/10 focus:border-[#fce003]/50 outline-none transition-all" 
              placeholder="Search by name, role, or skill..." 
              type="text"
            />
          </div>
          <div className="grid grid-cols-2 md:flex md:flex-row gap-2">
            <button 
              onClick={() => setShowFilters(true)}
              className={`w-full px-2 md:px-6 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 active:scale-95 ${selectedCountry !== 'All' || selectedSkill !== 'All' || sortOrder !== 'none' ? 'bg-[#fce003] border-[#fce003] text-black' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-sm">tune</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
            </button>
            <button 
              onClick={handleExport}
              className="w-full px-2 md:px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white/60 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
              title="Export to Excel"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Export</span>
            </button>
            <Link href="/team/new" className="col-span-2 md:col-span-1 w-full electric-gradient text-black px-4 md:px-6 py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 active:scale-95 shadow-xl uppercase tracking-widest shadow-yellow-400/20 hover:brightness-110">
              <span className="material-symbols-outlined text-sm">person_add</span>
              ADD DESIGNER
            </Link>
          </div>
        </div>

        {/* Strategic Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDesigners.map((designer, idx) => (
            <div key={designer.id || idx} className="group relative bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 hover:bg-white/[0.05] hover:border-[#fce003]/30 transition-all duration-500 overflow-hidden shadow-2xl">
              <Link href={`/team/${designer.id}`} className="absolute inset-0 z-10"></Link>
              
              {/* Visual Accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#fce003]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[#fce003]/10 transition-colors" />

              <div className="flex justify-between items-start mb-6 relative z-20">
                <div className="flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden ring-1 ring-white/10 group-hover:ring-[#fce003]/50 transition-all">
                    <Avatar
                      email={designer.email}
                      name={designer.name}
                      size={64}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline font-black text-white text-lg leading-tight group-hover:text-[#fce003] transition-colors">{designer.name}</h3>
                      <span className="text-[10px] leading-none">{designer.flag}</span>
                    </div>
                    <p className="text-[#fce003]/60 text-[8px] font-black uppercase tracking-[0.2em] mt-1">{designer.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-white/20 text-[7px] font-bold uppercase tracking-widest">{designer.experience}</p>
                      <span className="w-1 h-1 bg-white/10 rounded-full" />
                      <span className={`text-[7px] font-black uppercase tracking-widest ${designer.employmentType === 'In-House' ? 'text-white/40' : 'text-[#fce003]'}`}>
                        {designer.employmentType || 'Freelancer'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-[#fce003] group-hover:bg-[#fce003]/10 transition-all">
                  <span className="material-symbols-outlined text-sm">badge</span>
                </div>
              </div>

              {/* Performance Indicator */}
              <div className="mb-6 relative z-20">
                <div className="flex justify-between items-end mb-2">
                   <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Performance Protocol</p>
                   <p className="text-xs font-black text-[#fce003]">{designer.performance}%</p>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                   <div 
                     className="h-full bg-gradient-to-r from-orange-600 to-[#fce003] rounded-full shadow-[0_0_15px_rgba(252,224,3,0.3)] transition-all duration-1000"
                     style={{ width: `${designer.performance}%` }}
                   />
                </div>
              </div>

              {/* Specialization Tags */}
              <div className="flex flex-wrap gap-2 mb-6 relative z-20">
                {designer.tags?.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-white/5 rounded-lg text-[7px] font-black text-white/40 uppercase tracking-widest border border-white/5 group-hover:border-[#fce003]/20 transition-colors">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-20">
                 {designer.lastJob ? (
                    <div className="flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                       <p className="text-[7px] font-black text-orange-500 uppercase tracking-widest truncate max-w-[140px]">
                          Last Job: {designer.lastJob.title}
                       </p>
                    </div>
                 ) : (
                    <div className="flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                       <p className="text-[7px] font-black text-green-400 uppercase tracking-widest">Available for Deploy</p>
                    </div>
                 )}
                 <Link href={`/team/${designer.id}`} className="text-[#fce003] text-[8px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                    Dossier
                    <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                 </Link>
              </div>
            </div>
          ))}
          
          {filteredDesigners.length === 0 && (
            <div className="col-span-full py-32 text-center">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 opacity-20">
                <span className="material-symbols-outlined text-4xl">person_search</span>
              </div>
              <p className="text-white/30 font-bold uppercase tracking-[0.3em] text-xs italic">No matching talent found</p>
            </div>
          )}
        </div>
      </main>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowFilters(false)} />
          <div className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-[#fce003]/5 to-transparent">
              <div>
                <h3 className="text-white font-headline font-black text-xl italic uppercase tracking-tighter">Segment Talent</h3>
                <p className="text-neutral-500 text-[8px] uppercase tracking-[0.3em] font-bold">Designer Allocation Protocol</p>
              </div>
              <button onClick={() => setShowFilters(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block text-left">Classification</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All Type', icon: 'hub' },
                    { id: 'In-House', label: 'In-House', icon: 'domain' },
                    { id: 'Freelancer', label: 'Freelance', icon: 'public' }
                  ].map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => setEmploymentFilter(opt.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${employmentFilter === opt.id ? 'bg-[#fce003] border-[#fce003] text-stone-900 shadow-lg shadow-yellow-400/20' : 'bg-white/5 border-white/10 text-neutral-500'}`}
                    >
                      <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                      <span className="text-[8px] font-black uppercase">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block text-left">Hierarchy</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', label: 'Default', icon: 'groups' },
                    { id: 'performance', label: 'Top Perf', icon: 'trending_up' },
                    { id: 'role', label: 'By Role', icon: 'badge' }
                  ].map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => setSortOrder(opt.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${sortOrder === opt.id ? 'bg-[#fce003] border-[#fce003] text-stone-900 shadow-lg shadow-yellow-400/20' : 'bg-white/5 border-white/10 text-neutral-500'}`}
                    >
                      <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                      <span className="text-[8px] font-black uppercase">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 text-left">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Geographic Node</label>
                <div className="flex flex-wrap gap-2">
                  {countries.map(c => (
                    <button 
                      key={c}
                      onClick={() => setSelectedCountry(c)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCountry === c ? 'bg-[#fce003] border-[#fce003] text-black' : 'bg-white/5 border-white/10 text-neutral-500'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 text-left">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Specialization</label>
                <div className="flex flex-wrap gap-2">
                  {skills.map(s => (
                    <button 
                      key={s}
                      onClick={() => setSelectedSkill(s)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedSkill === s ? 'bg-[#fce003]/30 border-[#fce003]/50 text-[#fce003]' : 'bg-white/5 border-white/10 text-neutral-500'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 bg-white/2 border-t border-white/5">
              <button onClick={() => setShowFilters(false)} className="w-full electric-gradient py-5 rounded-2xl text-black font-black uppercase tracking-[0.2em] text-[11px] shadow-lg active:scale-[0.98] transition-transform">
                Apply Configuration
              </button>
            </div>
          </div>
        </div>
          )}
        </>
      )}
    </AuthGuard>
  );
}
