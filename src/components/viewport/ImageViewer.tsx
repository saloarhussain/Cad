'use client';

import React, { useState, useRef, useEffect } from 'react';
import { submitViewportFeedback } from '@/app/actions';

interface ImageViewerProps {
  images: any[];
  projectId: string;
  initialAnnotations?: any[];
  isReviewMode?: boolean;
}

export default function ImageViewer({ images, projectId, initialAnnotations = [], isReviewMode = false }: ImageViewerProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [annotations, setAnnotations] = useState<any[]>(initialAnnotations);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeImage = images[activeImageIndex]?.url || images[activeImageIndex] || '';

  useEffect(() => {
    if (initialAnnotations.length > 0) {
      setAnnotations(initialAnnotations);
    }
  }, [initialAnnotations]);

  const handleImageClick = (e: React.MouseEvent) => {
    if (!isAnnotating || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newAnno = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      comment: '',
      imageIndex: activeImageIndex,
      createdAt: new Date().toISOString()
    };

    setAnnotations([...annotations, newAnno]);
    setActiveAnnotationId(newAnno.id);
  };

  const updateComment = (id: string, comment: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, comment } : a));
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    if (activeAnnotationId === id) setActiveAnnotationId(null);
  };

  const handleSave = async () => {
    if (!projectId || annotations.length === 0) return;
    setIsSaving(true);
    try {
      const res = await submitViewportFeedback(projectId, annotations);
      if (res.success) {
        alert('Feedback submitted successfully!');
        setIsAnnotating(false);
        setActiveAnnotationId(null);
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex justify-between items-center px-6 md:px-0">
        <div className="flex gap-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveImageIndex(idx);
                setActiveAnnotationId(null);
              }}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-yellow-400 scale-105' : 'border-white/10 opacity-50 grayscale'
                }`}
            >
              <img src={img.url || img} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {!isReviewMode && (
          <button
            onClick={() => setIsAnnotating(!isAnnotating)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${isAnnotating ? 'bg-yellow-400 border-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
          >
            <span className="material-symbols-outlined text-sm">{isAnnotating ? 'edit_off' : 'add_comment'}</span>
            <span>{isAnnotating ? 'Stop' : 'Add Pins'}</span>
          </button>
        )}
      </div>

      <div className="flex-grow relative bg-zinc-900 rounded-3xl overflow-hidden border border-white/5 group">
        <div
          ref={containerRef}
          onClick={handleImageClick}
          className={`w-full h-full relative ${isAnnotating ? 'cursor-crosshair' : 'cursor-default'}`}
        >
          <img src={activeImage} className="w-full h-full object-contain pointer-events-none" />

          {/* Render Pins for CURRENT image */}
          {annotations.filter(a => a.imageIndex === activeImageIndex).map((anno, idx) => (
            <div
              key={anno.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveAnnotationId(anno.id);
              }}
              style={{ left: `${anno.x}%`, top: `${anno.y}%` }}
              className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${activeAnnotationId === anno.id
                  ? 'bg-yellow-400 border-black text-black scale-125 z-50'
                  : 'bg-black/80 border-yellow-400 text-yellow-400 hover:scale-110'
                }`}
            >
              <span className="text-[9px] font-black">{idx + 1}</span>
            </div>
          ))}
        </div>

        {isAnnotating && !activeAnnotationId && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
            Click image to add a pin
          </div>
        )}
      </div>

      {/* Side Feedback Panel (Active Annotation) */}
      {activeAnnotationId && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Pin Feedback</span>
            <button onClick={() => setActiveAnnotationId(null)} className="text-white/40"><span className="material-symbols-outlined text-sm">close</span></button>
          </div>
          <textarea
            readOnly={isReviewMode}
            value={annotations.find(a => a.id === activeAnnotationId)?.comment || ''}
            onChange={(e) => updateComment(activeAnnotationId, e.target.value)}
            placeholder="Describe the revision..."
            className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-white focus:ring-0 focus:border-yellow-400/50 h-20"
          />
          {!isReviewMode && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => deleteAnnotation(activeAnnotationId)} className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-500 text-[9px] font-black uppercase">Delete</button>
              <button onClick={() => setActiveAnnotationId(null)} className="flex-1 py-2 rounded-lg bg-white/10 text-white text-[9px] font-black uppercase">Save</button>
            </div>
          )}
        </div>
      )}

      {isAnnotating && annotations.length > 0 && !activeAnnotationId && (
        <button
          onClick={handleSave}
          className="w-full py-4 rounded-2xl electric-gradient text-black font-black uppercase tracking-widest text-[10px]"
        >
          {isSaving ? 'Saving...' : `Submit ${annotations.length} Pins`}
        </button>
      )}
    </div>
  );
}
