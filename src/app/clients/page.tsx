"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { getDb } from '@/app/actions';
import Avatar from '@/components/Avatar';
import AuthGuard from '@/components/AuthGuard';
import { utils, writeFile } from 'xlsx';

const countryMap: Record<string, { flag: string; code: string }> = {
  'United States': { flag: '🇺🇸', code: 'USA' },
  'United Kingdom': { flag: '🇬🇧', code: 'GBR' },
  'United Arab Emirates': { flag: '🇦🇪', code: 'UAE' },
  'India': { flag: '🇮🇳', code: 'IND' },
  'Belgium': { flag: '🇧🇪', code: 'BEL' },
  'France': { flag: '🇫🇷', code: 'FRA' },
  'GLOBAL': { flag: '🌐', code: 'GLB' }
};

const initialMockClients: any[] = [];

export default function ClientsPage() {
  const [realClients, setRealClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('none'); 
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [earningBracket, setEarningBracket] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const db = await getDb();
      if (db.clients) {
        const projects = db.projects || [];
        const formatted = db.clients.map((c: any) => {
          let countryKey = c.country;
          if (!countryKey && c.mobile?.startsWith('+91')) {
            countryKey = 'India';
          }
          if (!countryKey) {
            countryKey = 'GLOBAL';
          }

          const cInfo = countryMap[countryKey] || countryMap['GLOBAL'];
          
          // Data Correction: In the current database, it appears 'name' stores the company 
          // and 'companyName' stores the person's name for some entries.
          const personName = c.companyName || c.name;
          const companyLabel = c.companyName ? c.name : 'Independent Partner';

          // Calculate Real Project Stats
          const clientProjects = projects.filter((p: any) => 
            p.client === c.name || 
            p.client === c.companyName || 
            p.client === personName
          );

          const doneCount = clientProjects.filter((p: any) => p.status === 'Approved').length;
          const liveCount = clientProjects.length - doneCount;
          const totalEarnings = clientProjects.reduce((sum: number, p: any) => sum + (parseFloat(p.revenue) || 0), 0);

          return {
            ...c,
            name: personName,
            contact: companyLabel,
            location: cInfo.code,
            flag: cInfo.flag,
            earningsValue: totalEarnings,
            earnings: `$${totalEarnings.toLocaleString()}`,
            done: doneCount,
            live: liveCount,
            icon: 'person',
            color: 'text-primary-fixed',
            borderColor: 'border-white/5'
          };
        });
        setRealClients(formatted);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const allClients = useMemo(() => [...initialMockClients, ...realClients], [realClients]);

  const countries = useMemo(() => ['All', ...new Set(allClients.map(c => c.location))], [allClients]);
  const earningsBrackets = ['All', '>$100k', '<$100k'];

  const filteredClients = useMemo(() => {
    let result = allClients.filter(client => {
      const searchStr = `${client.name} ${client.contact}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
      const matchesCountry = selectedCountry === 'All' || client.location === selectedCountry;
      const matchesEarnings = earningBracket === 'All' || 
                            (earningBracket === '>$100k' ? client.earningsValue >= 100000 : client.earningsValue < 100000);
      
      return matchesSearch && matchesCountry && matchesEarnings;
    });

    if (sortOrder === 'earnings') {
      result.sort((a, b) => b.earningsValue - a.earningsValue);
    } else if (sortOrder === 'projects') {
      result.sort((a, b) => (b.done + b.live) - (a.done + a.live));
    }

    return result;
  }, [allClients, searchQuery, sortOrder, selectedCountry, earningBracket]);

  const handleExport = () => {
    const dataToExport = filteredClients.map(client => ({
      'Customer Name': client.name,
      'Company/Contact': client.contact,
      'Email': client.email,
      'Mobile': client.mobile,
      'Location': client.location,
      'Total Revenue': client.earnings,
      'Done Projects': client.done,
      'Live Projects': client.live,
      'Created At': client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'N/A'
    }));

    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Clients");
    
    // Set column widths
    const wscols = [
      { wch: 25 }, // Name
      { wch: 25 }, // Company
      { wch: 30 }, // Email
      { wch: 20 }, // Mobile
      { wch: 10 }, // Location
      { wch: 15 }, // Revenue
      { wch: 10 }, // Done
      { wch: 10 }, // Live
      { wch: 15 }  // Date
    ];
    worksheet['!cols'] = wscols;

    writeFile(workbook, `CADONCE_Clients_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-background text-on-surface font-body min-h-screen">


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
                Client <span className="text-[#fce003]">Intelligence</span>
              </h2>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">High-value partner relationship management</p>
            </div>
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full md:w-auto">
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Total Partners</p>
                <p className="text-sm font-black text-white">{allClients.length}</p>
              </div>
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-[7px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Active Value</p>
                <p className="text-sm font-black text-[#fce003]">${allClients.reduce((acc, c) => acc + c.earningsValue, 0).toLocaleString()}</p>
              </div>
              <div className="hidden sm:block px-4 py-2 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
                <p className="text-[7px] font-black text-yellow-400 uppercase tracking-widest mb-0.5">Status</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-[8px] font-black text-white uppercase">Operational</span>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Filters & Search Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-[#fce003] transition-colors">search</span>
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white placeholder:text-neutral-600 focus:bg-white/10 focus:border-[#fce003]/50 outline-none transition-all" 
                placeholder="Search by company, name, or location..." 
                type="text"
              />
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row gap-2">
              <button 
                onClick={() => setShowFilters(true)}
                className={`w-full px-2 md:px-6 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 active:scale-95 ${selectedCountry !== 'All' || earningBracket !== 'All' || sortOrder !== 'none' ? 'bg-[#fce003] border-[#fce003] text-black' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
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
              <Link href="/clients/new" className="col-span-2 md:col-span-1 w-full electric-gradient text-black px-4 md:px-6 py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 active:scale-95 shadow-xl uppercase tracking-widest shadow-yellow-400/20 hover:brightness-110">
                <span className="material-symbols-outlined text-sm">person_add</span>
                ADD CLIENT
              </Link>
            </div>
          </div>

          {/* Strategic Client Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client, idx) => (
              <Link 
                key={client.id || idx} 
                href={`/clients/${client.id}`}
                className="group relative bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 hover:bg-white/[0.05] hover:border-[#fce003]/30 transition-all duration-500 overflow-hidden shadow-2xl block"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#fce003]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[#fce003]/10 transition-colors" />

                <div className="flex justify-between items-start mb-6 relative z-20">
                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-white/10 group-hover:ring-[#fce003]/50 transition-all">
                      <Avatar
                        email={client.email}
                        name={client.name}
                        size={56}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-left">
                      <h3 className="font-headline font-black text-white text-lg leading-tight group-hover:text-[#fce003] transition-colors">{client.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">{client.contact}</span>
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                          <span className="text-[10px] leading-none">{client.flag}</span>
                          <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">{client.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-[#fce003] group-hover:bg-[#fce003]/10 transition-all">
                    <span className="material-symbols-outlined text-sm">arrow_outward</span>
                  </div>
                </div>

                {/* KPI Section */}
                <div className="grid grid-cols-2 gap-3 mb-6 relative z-20">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group-hover:border-[#fce003]/10 transition-colors">
                    <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1">Total Revenue</p>
                    <p className="font-headline font-black text-white text-xl tracking-tight leading-none">{client.earnings}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group-hover:border-[#fce003]/10 transition-colors flex justify-between items-center">
                    <div>
                      <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1">Queue</p>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-xs font-black text-white leading-none">{client.done}</p>
                          <p className="text-[6px] font-bold text-neutral-600 uppercase">Done</p>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="text-center">
                          <p className="text-xs font-black text-[#fce003] leading-none">{client.live}</p>
                          <p className="text-[6px] font-bold text-neutral-600 uppercase">Live</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-20">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${client.live > 0 ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-neutral-600'}`} />
                      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{client.live > 0 ? 'Active Workflow' : 'Idle Queue'}</span>
                   </div>
                   <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-tighter">ID: {client.id?.slice(-8).toUpperCase()}</span>
                </div>
              </Link>
            ))}
            
            {filteredClients.length === 0 && (
              <div className="col-span-full py-32 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 opacity-20">
                  <span className="material-symbols-outlined text-4xl">person_search</span>
                </div>
                <p className="text-white/30 font-bold uppercase tracking-[0.3em] text-xs italic">No matching partner records found</p>
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
                  <h3 className="text-white font-headline font-black text-xl italic uppercase tracking-tighter">Segment Data</h3>
                  <p className="text-neutral-500 text-[8px] uppercase tracking-[0.3em] font-bold">Partner Optimization Protocol</p>
                </div>
                <button onClick={() => setShowFilters(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                {/* Sort Order */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block text-left">Hierarchy</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['none', 'earnings', 'projects'].map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setSortOrder(opt)}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${sortOrder === opt ? 'bg-[#fce003] border-[#fce003] text-black shadow-lg shadow-yellow-400/20' : 'bg-white/5 border-white/10 text-neutral-500'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Country Filter */}
                <div className="space-y-4 text-left">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Geographic Node</label>
                  <div className="flex flex-wrap gap-2">
                    {countries.map(c => (
                      <button 
                        key={c}
                        onClick={() => setSelectedCountry(c)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCountry === c ? 'bg-cyan-400 border-cyan-400 text-black' : 'bg-white/5 border-white/10 text-neutral-500'}`}
                      >
                        {c}
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
    </div>
  );
}
