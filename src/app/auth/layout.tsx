'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';

const THEMES = [
  {
    id: 'jewelry',
    headline: "For Organizations",
    title: (
      <>THE GLOBAL <span className="text-[#fce003]">ORGANIZATION</span> <br /> COMMAND CENTER</>
    ),
    description: "Scale your studio and manage global design teams from a single high-fidelity dashboard. Stop losing margins—keep 100% of your profits.",
    image: "/jewelry_clean.png",
    stats: [
      { label: "COMMISSIONS", value: "0%" },
      { label: "PROFIT MARGIN", value: "100%" },
      { label: "STUDIO PORTAL", value: "FREE" }
    ],
    tag: "Scale your organization at zero cost"
  },
  {
    id: 'civil',
    headline: "For Designers",
    title: (
      <>THE PROFESSIONAL <span className="text-[#fce003]">DESIGNER</span> <br /> WORKSTATION</>
    ),
    description: "Access elite global projects and track your performance in a prestigious workstation. Gain master status and keep every dollar you earn.",
    image: "/civil_hybrid.png",
    stats: [
      { label: "COMMISSION", value: "0%" },
      { label: "DESIGNER ACCESS", value: "ELITE" },
      { label: "WORKSTATION", value: "FREE" }
    ],
    tag: "High-status freelancing hub"
  },
  {
    id: 'interior',
    headline: "For Everyone",
    title: (
      <>THE PREMIER <span className="text-[#fce003]">CAD</span> <br /> COLLABORATION HUB</>
    ),
    description: "A commission-free ecosystem built exclusively for high-end CAD production. No hidden platform fees, just world-class creation.",
    image: "/interior_hybrid.png",
    stats: [
      { label: "PLATFORM FEES", value: "NONE" },
      { label: "MEMBERSHIP", value: "FREE" },
      { label: "GLOBAL SYNC", value: "24/7" }
    ],
    tag: "Free global collaboration"
  },
  {
    id: 'mechanical',
    headline: "For Elite Studios",
    title: (
      <>THE HIGH-SPEED <span className="text-[#fce003]">PRODUCTION</span> <br /> ENGINE</>
    ),
    description: "The professional bridge between master designers and global brands. Launch projects instantly and scale your production without boundaries.",
    image: "/mechanical_hybrid.png",
    stats: [
      { label: "PRECISION", value: "1:1" },
      { label: "VELOCITY", value: "MAX" },
      { label: "ORGANIZATION PORTAL", value: "FREE" }
    ],
    tag: "Unlimited scale & speed"
  }
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const theme = THEMES[0]; // Locked to the approved Jewelry theme

  return (
    <div className="min-h-screen bg-[#0c0a04] flex flex-col md:flex-row overflow-hidden">
      <div className="hidden md:flex relative w-full md:w-3/5 lg:w-2/3 h-screen bg-[#0c0a04] flex-col justify-between p-8 md:p-12 overflow-hidden">
        {/* Uniform Background - No Glows */}


        {/* Top: Logo & Nav */}
        <div className="relative z-30 flex items-center gap-4">
           <div className="w-12 h-12 bg-[#fce003] rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(252,224,3,0.3)]">
              <span className="material-symbols-outlined text-black text-2xl font-black">architecture</span>
           </div>
           <div>
              <h1 className="text-2xl font-headline font-black text-white tracking-tighter uppercase italic leading-none">
                CAD<span className="text-[#fce003]">ONCE</span>
              </h1>
              <p className="text-[10px] font-bold text-[#fce003] mt-1 drop-shadow-[0_0_100px_rgba(252,224,3,0.5)]">
                {theme.headline}
              </p>
           </div>
        </div>

        {/* Center: Hero Content */}
        <div className="relative z-30 max-w-2xl lg:max-w-4xl">
           <h2 className="text-4xl md:text-6xl font-headline font-black text-white tracking-[0.02em] uppercase italic leading-[0.9] [text-shadow:0_4px_40px_rgba(0,0,0,0.9)]">
             {theme.title}
           </h2>
           <p className="mt-8 text-white/90 text-base md:text-lg font-medium leading-relaxed max-w-md [text-shadow:0_2px_20px_rgba(0,0,0,0.9)]">
             {theme.description}
           </p>
           
           <div className="mt-12 flex flex-wrap gap-8 items-center">
              {theme.stats.map((stat, idx) => (
                <React.Fragment key={stat.label}>
                  <div className="flex flex-col [text-shadow:0_2px_10px_rgba(0,0,0,0.5)]">
                    <span className="text-[#fce003] font-black text-xl italic tracking-tighter uppercase leading-none">{stat.value}</span>
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">{stat.label}</span>
                  </div>
                  {idx < theme.stats.length - 1 && <div className="w-px h-8 bg-white/10"></div>}
                </React.Fragment>
              ))}
           </div>
        </div>

        {/* Balanced Masterpiece: Industry CAD Masterpiece */}
        <div className="absolute top-1/2 left-[60%] -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] opacity-60 md:opacity-100 pointer-events-none transition-transform duration-[20s] hover:scale-105 ease-out">
           <img 
             src={theme.image} 
             alt={`${theme.id} CAD Masterpiece`}
             className="w-full h-full object-contain filter drop-shadow-[0_0_100px_rgba(252,224,3,0.15)] mix-blend-screen"
             style={{
               maskImage: 'radial-gradient(circle at center, black 15%, transparent 75%)',
               WebkitMaskImage: 'radial-gradient(circle at center, black 15%, transparent 75%)'
             }}
           />
        </div>

        {/* Footer Brand Tag */}
        {/* Soft Edge Transition Overlay */}
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#0c0a04] via-[#0c0a04]/90 to-transparent z-20 pointer-events-none"></div>
        <div className="relative z-10">
           <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Precision Management for Modern Studios</p>
        </div>
      </div>

      {/* Right Pane: Auth Forms (Full Screen on Mobile) */}
      <div className="w-full md:w-1/2 lg:w-[40%] min-h-screen md:min-h-0 bg-[#0c0a04] flex flex-col items-center justify-start md:justify-center py-12 md:py-6 px-6 relative gap-8 md:gap-0">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/[0.03] via-transparent to-transparent pointer-events-none"></div>
        
        {/* Mobile Logo Header */}
        <div className="flex justify-center md:hidden z-20">
           <h1 className="text-3xl font-headline font-black text-white tracking-tighter uppercase italic">
             CAD<span className="text-[#fce003]">ONCE</span>
           </h1>
        </div>

        <div className="w-full max-w-xl relative z-10 bg-white/[0.02] backdrop-blur-3xl p-8 md:p-10 rounded-[2.5rem] border border-white/5 shadow-2xl md:mt-0 transition-all duration-500">
           {children}
        </div>
      </div>
    </div>
  );
}
