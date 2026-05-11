'use client';

import React, { useState, useEffect } from 'react';
import { getProjectById, submitClientBrief, getCloudinarySignature } from '../../actions';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function ClientBriefPage() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Form State
  const [vision, setVision] = useState('');
  const [colors, setColors] = useState('');
  const [materials, setMaterials] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      if (id) {
        const data = await getProjectById(id as string);
        setProject(data);
        setLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const signatureData = await getCloudinarySignature();
      if (!signatureData) throw new Error('Cloudinary not configured');

      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', signatureData.apiKey || '');
        formData.append('timestamp', signatureData.timestamp.toString());
        formData.append('signature', signatureData.signature);
        formData.append('folder', 'client_briefs');

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        const data = await response.json();
        if (data.secure_url) uploadedUrls.push(data.secure_url);
      }
      setReferenceImages([...referenceImages, ...uploadedUrls]);
    } catch (err) {
      console.error('Upload Error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    const briefData = {
      vision,
      colors,
      materials,
      targetAudience,
      referenceImages
    };

    const result = await submitClientBrief(id as string, briefData);
    if (result.success) {
      setSubmitted(true);
    } else {
      alert('Error submitting brief. Please try again.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full"
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-4xl font-bold mb-4">Project Not Found</h1>
          <p className="text-white/60">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[25%] -right-[10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <header className="mb-12">
                <span className="text-white/40 uppercase tracking-[0.2em] text-xs font-medium mb-3 block">Design Specification</span>
                <h1 className="text-5xl font-bold tracking-tight mb-4">
                  Define your vision for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{project.title}</span>
                </h1>
                <p className="text-lg text-white/50 leading-relaxed max-w-xl">
                  Your designer is ready to bring this project to life. Tell us what you have in mind to ensure a perfect result.
                </p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-12">
                {/* Design Vision */}
                <section className="space-y-4">
                  <label className="text-xl font-semibold block">The Vision</label>
                  <p className="text-sm text-white/40 mb-2">Describe the overall aesthetic, mood, and goal of the design.</p>
                  <textarea
                    required
                    value={vision}
                    onChange={(e) => setVision(e.target.value)}
                    placeholder="e.g. A sleek, futuristic jacket with integrated LED piping and a heavy focus on utility..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[160px] text-lg focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20 resize-none"
                  />
                </section>

                {/* Specifics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section className="space-y-4">
                    <label className="text-lg font-semibold block">Color Palette</label>
                    <input
                      type="text"
                      value={colors}
                      onChange={(e) => setColors(e.target.value)}
                      placeholder="e.g. Matte Black, Neon Cyan"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:border-white/30 transition-all"
                    />
                  </section>
                  <section className="space-y-4">
                    <label className="text-lg font-semibold block">Target Audience</label>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="e.g. Gen Z Streetwear Enthusiasts"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:border-white/30 transition-all"
                    />
                  </section>
                </div>

                <section className="space-y-4">
                  <label className="text-lg font-semibold block">Materials & Texture</label>
                  <input
                    type="text"
                    value={materials}
                    onChange={(e) => setMaterials(e.target.value)}
                    placeholder="e.g. Gore-Tex, Carbon Fiber Mesh"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:border-white/30 transition-all"
                  />
                </section>

                {/* Reference Images */}
                <section className="space-y-6">
                  <label className="text-xl font-semibold block">Reference Imagery</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {referenceImages.map((url, i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 relative group">
                        <img src={url} className="w-full h-full object-cover" alt="Reference" />
                        <button 
                          type="button"
                          onClick={() => setReferenceImages(referenceImages.filter((_, idx) => idx !== i))}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 bg-white/[0.02]">
                      <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      {uploading ? (
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="text-2xl">+</span>
                          <span className="text-xs text-white/40 uppercase tracking-widest">Upload</span>
                        </>
                      )}
                    </label>
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={submitting || !vision}
                  className="w-full bg-white text-black font-bold py-5 rounded-2xl text-xl hover:bg-white/90 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {submitting ? 'Transmitting...' : 'Send to Design Team'}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                <svg className="w-12 h-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold mb-4">Brief Transmitted</h2>
              <p className="text-white/60 text-lg mb-12">Your requirements have been synced with the project workstation. The design team has been notified.</p>
              <button 
                onClick={() => window.close()}
                className="px-8 py-3 bg-white/10 border border-white/20 rounded-full hover:bg-white/20 transition-all"
              >
                Close Portal
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
