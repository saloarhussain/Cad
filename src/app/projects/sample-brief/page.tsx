'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function SampleBriefPage() {
  return (
    <div className="min-h-screen bg-[#0c0a04] text-white font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 border-b border-white/10 pb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-[#fce003]">Design Briefing <span className="text-white">Sample</span></h1>
          <p className="text-neutral-500 mt-2 uppercase tracking-[0.3em] text-[10px] font-bold">Standard Operating Procedure • Reference Guide</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Example 1 */}
          <section className="space-y-6">
            <div className="bg-surface-container p-8 rounded-[2rem] border border-[#fce003]/20 shadow-2xl">
              <span className="bg-[#fce003] text-black text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block">Pro Example</span>
              <h2 className="text-xl font-bold mb-2">Bespoke Emerald Cocktail Ring</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                "We need a high-luxury cocktail ring centered around a 4ct cushion-cut emerald. The band should be 18k yellow gold with a 'hidden' halo of micro-pavé diamonds. 
                <br/><br/>
                <span className="text-[#fce003] font-bold underline">Measurements:</span> Ring size US 7. Emerald dimensions are 10mm x 8.5mm. Main band width should be 2.2mm tapering to 1.8mm at the base."
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square bg-stone-900 rounded-2xl border border-white/5 overflow-hidden relative group">
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/20 uppercase">Reference 1</div>
                <img src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover opacity-60" />
              </div>
              <div className="aspect-square bg-stone-900 rounded-2xl border border-white/5 overflow-hidden relative group">
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/20 uppercase">Measurement Doc</div>
                <img src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover opacity-60" />
              </div>
            </div>
          </section>

          {/* Guide Section */}
          <section className="space-y-8">
            <div>
              <h3 className="text-[#fce003] text-xs font-black uppercase tracking-widest mb-4">Required Details</h3>
              <ul className="space-y-4">
                {[
                  { title: "Core Vision", desc: "Clearly state the item type, main materials, and overall aesthetic (e.g., Minimalist, Baroque, Industrial)." },
                  { title: "Technical Dimensions", desc: "Crucial! Provide exact measurements in mm for stones, band widths, chain lengths, or overall dimensions." },
                  { title: "Reference Material", desc: "Upload sketches, photos of similar items, or even hand-drawn diagrams with measurements." },
                  { title: "Material Specs", desc: "Specify metal types (14k, 18k, Platinum) and stone types/clarity expectations." }
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="size-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold">{i+1}</div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-neutral-500 leading-relaxed mt-1">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 bg-[#fce003]/5 border border-[#fce003]/10 rounded-2xl">
              <h4 className="text-[10px] font-black text-[#fce003] uppercase tracking-widest mb-2">💡 Expert Tip</h4>
              <p className="text-xs text-neutral-400 leading-relaxed italic">
                "The more detail you provide about measurements, the fewer revisions we'll need. Always try to include a top-view and side-view reference if possible."
              </p>
            </div>

            <button 
              onClick={() => window.close()}
              className="w-full py-4 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all"
            >
              Return to Intake Form
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
