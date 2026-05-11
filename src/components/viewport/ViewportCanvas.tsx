"use client";

import React, { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Stage,
  PerspectiveCamera,
  Html,
  useProgress,
  Environment
} from '@react-three/drei';
import JewelryModel, { MetalType, JewelryModelFromData } from './JewelryModel';

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-yellow-400 font-headline font-black text-xs tracking-widest uppercase">
          {Math.round(progress)}% Loaded
        </div>
      </div>
    </Html>
  );
}

import { submitViewportFeedback } from '@/app/actions';

interface ViewportCanvasProps {
  fileUrl: string;
  metalType: MetalType;
  fileName?: string;
  fileData?: ArrayBuffer;
  onCapture?: (dataUrl: string) => void;
  projectId?: string;
  initialAnnotations?: Annotation[];
  isReviewMode?: boolean;
  isAutoRotate?: boolean;
}

interface Annotation {
  id: string;
  position: [number, number, number];
  comment: string;
  createdAt: string;
}

export default function ViewportCanvas({ fileUrl, metalType, fileName, fileData, projectId, initialAnnotations = [], isReviewMode = false, isAutoRotate = true }: ViewportCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [env, setEnv] = React.useState<'studio' | 'apartment' | 'city' | 'dawn' | 'lobby' | 'warehouse'>('studio');
  const [annotations, setAnnotations] = React.useState<Annotation[]>(initialAnnotations);
  const [isAnnotating, setIsAnnotating] = React.useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Sync initial annotations if they change (useful for navigating between revisions)
  React.useEffect(() => {
    if (initialAnnotations.length > 0) {
      setAnnotations(initialAnnotations);
    }
  }, [initialAnnotations]);

  const modelRef = React.useRef<THREE.Mesh>(null);

  const handleCapture = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `cad-render-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleModelClick = (e: any) => {
    if (!isAnnotating) return;

    // Stop event propagation to prevent OrbitControls movement if needed
    e.stopPropagation();

    const { point, face, object } = e;

    // Calculate surface normal in world space to offset the pin slightly
    // This prevents "Z-fighting" / flickering because the pin won't be exactly flush with the surface
    const worldNormal = face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(object.matrixWorld)).normalize();
    const offsetPoint = point.clone().add(worldNormal.multiplyScalar(0.15));

    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      position: [offsetPoint.x, offsetPoint.y, offsetPoint.z],
      comment: '',
      createdAt: new Date().toISOString()
    };

    setAnnotations([...annotations, newAnnotation]);
    setActiveAnnotationId(newAnnotation.id);
  };

  const updateAnnotationComment = (id: string, comment: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, comment } : a));
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    if (activeAnnotationId === id) setActiveAnnotationId(null);
  };

  const handleSaveFeedback = async () => {
    if (!projectId || annotations.length === 0) return;

    setIsSaving(true);
    try {
      const res = await submitViewportFeedback(projectId, annotations);
      if (res.success) {
        alert('Annotations saved! Your feedback has been submitted to the design team.');
        setIsAnnotating(false);
        setActiveAnnotationId(null);
      } else {
        alert('Failed to save feedback: ' + res.error);
      }
    } catch (err: any) {
      alert('Error saving feedback: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const cleanUrl = (fileUrl || '').split('?')[0].toLowerCase();
  const isStl = cleanUrl.endsWith('.stl') || (fileName && fileName.toLowerCase().endsWith('.stl'));
  const isObj = cleanUrl.endsWith('.obj') || (fileName && fileName.toLowerCase().endsWith('.obj'));
  const is3D = isStl || isObj;
  const displayExt = fileName ? fileName.split('.').pop()?.toUpperCase() : (cleanUrl.split('.').pop()?.toUpperCase() || 'CAD');

  if (!is3D) {
    return (
      <div className="w-full h-[600px] bg-[#0c0a04] md:rounded-3xl overflow-hidden md:border border-white/5 relative flex items-center justify-center p-12 text-center">
        <div className="max-w-xs">
          <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center text-yellow-400 mx-auto mb-6 border border-yellow-400/20">
            <span className="material-symbols-outlined text-3xl">3d_rotation</span>
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3">3D Preview Limited</h3>
          <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed mb-8">
            The interactive 3D engine currently supports .STL and .OBJ files for real-time viewing.
            <br /><br/>
            This {displayExt} file is ready for download, but cannot be rotated in this preview.
          </p>
          <button
            onClick={() => window.location.href = fileUrl}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Download CAD File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0c0a04] md:rounded-3xl overflow-hidden md:border border-white/5 relative group flex flex-col md:flex-row">
      {/* 3D Viewport */}
      <div className="flex-grow w-full h-full relative overflow-hidden">
        <Canvas
          ref={canvasRef}
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [0, 0, 5], fov: 45 }}
        >
          <Suspense fallback={<Loader />}>
            <Stage
              environment={env}
              intensity={1.5}
              adjustCamera={1.8}
              preset="rembrandt"
              shadows="contact"
            >
              {fileData ? (
                <JewelryModelFromData
                  ref={modelRef}
                  data={fileData}
                  isObj={fileName?.toLowerCase().endsWith('.obj') || false}
                  metalType={metalType}
                  onPointerDown={handleModelClick}
                />
              ) : fileUrl ? (
                <JewelryModel
                  ref={modelRef}
                  url={fileUrl}
                  fileName={fileName}
                  metalType={metalType}
                  onPointerDown={handleModelClick}
                />
              ) : null}
            </Stage>

            {/* Render Pins */}
            {annotations.map((anno, index) => (
              <Html
                key={anno.id}
                position={anno.position}
                center
                occlude={true}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAnnotationId(anno.id);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-2 shadow-2xl transition-all duration-300 ${activeAnnotationId === anno.id
                      ? 'bg-yellow-400 border-black text-black z-50 ring-4 ring-yellow-400/30'
                      : 'bg-black/90 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black'
                    }`}
                >
                  <span className="text-[10px] font-black">{index + 1}</span>
                </div>
              </Html>
            ))}

            <OrbitControls
              makeDefault
              autoRotate={isAutoRotate && !isAnnotating && !activeAnnotationId}
              autoRotateSpeed={0.5}
              minDistance={2}
              maxDistance={15}
              enableDamping
            />
          </Suspense>
        </Canvas>

        {/* Toolbar Overlay - Positioned for both desktop and mobile */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 md:gap-4 z-10 max-w-[calc(100%-2rem)]">
          <div className="hidden sm:block text-center">
            <span className="text-[9px] font-black text-yellow-400/50 uppercase tracking-[0.2em] mb-2 block">Environment</span>
            <div className="flex flex-wrap justify-center gap-1.5 p-1 bg-black/60 backdrop-blur-xl rounded-xl border border-white/5">
              {(['studio', 'apartment', 'city', 'dawn', 'lobby', 'warehouse'] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${env === e
                      ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/10'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {!isReviewMode && (
            <button
              onClick={() => setIsAnnotating(!isAnnotating)}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-black uppercase tracking-widest text-[9px] transition-all active:scale-[0.98] ${isAnnotating
                  ? 'bg-yellow-400 border-yellow-400 text-black shadow-[0_0_20px_rgba(252,224,3,0.3)]'
                  : 'bg-black/60 border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
            >
              <span className="material-symbols-outlined text-sm">{isAnnotating ? 'edit_off' : 'add_comment'}</span>
              <span>{isAnnotating ? 'Stop Annotating' : 'Add Annotation'}</span>
            </button>
          )}
        </div>

        {/* Instructions Overlay */}
        {isAnnotating && !activeAnnotationId && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="bg-yellow-400/90 text-black px-6 py-3 rounded-full font-black uppercase tracking-[0.2em] text-[9px] md:text-[10px] animate-pulse">
              Click model to place pin
            </div>
          </div>
        )}

        {/* Mobile Sticky Feedback Tray */}
        {(isAnnotating || isReviewMode) && activeAnnotationId && (
          <div className="md:hidden absolute bottom-4 left-4 right-4 animate-in slide-in-from-bottom duration-300 z-30">
            <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-yellow-400 text-black rounded flex items-center justify-center text-[9px] font-black">
                    {annotations.findIndex(a => a.id === activeAnnotationId) + 1}
                  </span>
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Active Pin</span>
                </div>
                <button
                  onClick={() => setActiveAnnotationId(null)}
                  className="text-white/40"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <textarea
                readOnly={isReviewMode}
                autoFocus={!isReviewMode}
                value={annotations.find(a => a.id === activeAnnotationId)?.comment || ''}
                onChange={(e) => updateAnnotationComment(activeAnnotationId, e.target.value)}
                placeholder="What needs to change here?"
                className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-[11px] font-medium text-white placeholder:text-white/20 focus:ring-0 focus:border-yellow-400/50 resize-none h-24"
              />
              <div className="flex gap-2 mt-3">
                {!isReviewMode && (
                  <button
                    onClick={() => deleteAnnotation(activeAnnotationId)}
                    className="flex-grow py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase tracking-widest text-[9px]"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setActiveAnnotationId(null)}
                  className="flex-grow py-3 rounded-xl bg-white/10 border border-white/5 text-white font-black uppercase tracking-widest text-[9px]"
                >
                  {isReviewMode ? 'Close' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Floating Save Button */}
        {isAnnotating && annotations.length > 0 && !activeAnnotationId && (
          <div className="md:hidden absolute bottom-4 left-4 right-4 z-20 animate-in slide-in-from-bottom duration-500">
            <button
              onClick={handleSaveFeedback}
              disabled={isSaving}
              className="w-full electric-gradient text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl shadow-2xl flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">publish</span>
                  <span>Save {annotations.length} Pins</span>
                </>
              )}
            </button>
          </div>
        )}

        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10">
          <button
            onClick={handleCapture}
            className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl text-white hover:bg-yellow-400 hover:text-black transition-all active:scale-95 flex items-center gap-2 shadow-2xl"
          >
            <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Snapshot</span>
            <span className="material-symbols-outlined text-sm">photo_camera</span>
          </button>
        </div>
      </div>

      {/* Annotation Sidebar (Desktop Only) */}
      {(annotations.length > 0 || (isAnnotating && !isReviewMode)) && (
        <aside className="hidden md:flex w-80 bg-black/40 backdrop-blur-2xl border-l border-white/5 flex-col p-6 animate-in slide-in-from-right duration-500">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400 text-sm">sticky_note_2</span>
              {isReviewMode ? 'Client Review' : 'Feedback Pins'}
            </h3>
            <span className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] font-black text-neutral-500 uppercase">{annotations.length}</span>
          </div>

          <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {annotations.length === 0 ? (
              <div className="text-center py-12 opacity-30">
                <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                <p className="text-[9px] font-bold uppercase tracking-widest">No annotations yet</p>
              </div>
            ) : (
              annotations.map((anno, idx) => (
                <div
                  key={anno.id}
                  onClick={() => setActiveAnnotationId(anno.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${activeAnnotationId === anno.id
                      ? 'bg-white/10 border-yellow-400/50'
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black ${activeAnnotationId === anno.id ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'
                      }`}>
                      {idx + 1}
                    </span>
                    {!isReviewMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnnotation(anno.id);
                        }}
                        className="text-neutral-600 hover:text-red-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                    {isReviewMode && (
                      <span className="material-symbols-outlined text-yellow-400 text-sm opacity-50">lock</span>
                    )}
                  </div>

                  <textarea
                    readOnly={isReviewMode}
                    value={anno.comment}
                    onChange={(e) => updateAnnotationComment(anno.id, e.target.value)}
                    placeholder="Describe the change needed..."
                    className="w-full bg-transparent border-none p-0 text-[11px] font-medium text-neutral-300 focus:ring-0 placeholder:text-neutral-700 resize-none h-16"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="text-[8px] font-black text-neutral-600 uppercase tracking-tighter mt-2">
                    Pos: {anno.position.map(p => p.toFixed(2)).join(', ')}
                  </div>
                </div>
              ))
            )}
          </div>

          {!isReviewMode && (
            <div className="mt-8 pt-6 border-t border-white/5">
              <button
                className="w-full electric-gradient text-black font-black uppercase text-[10px] py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                disabled={annotations.length === 0 || isSaving}
                onClick={handleSaveFeedback}
              >
                {isSaving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save All Feedback'
                )}
              </button>
            </div>
          )}

          {isReviewMode && (
            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="p-4 rounded-xl bg-yellow-400/5 border border-yellow-400/10">
                <p className="text-[10px] font-bold text-yellow-400 uppercase leading-tight mb-2">Designer Note</p>
                <p className="text-[10px] text-white/40 leading-relaxed italic">
                  You are in Review Mode. These pins represent exact client placement. Please update the CAD file based on these locations.
                </p>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

