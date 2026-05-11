"use client";

import React, { useState, useRef } from 'react';
import { getSignedUploadUrl } from '@/app/actions';

interface CadFileUploadProps {
  projectId: string;
  initialPath?: string;
  onUploadSuccess: (path: string) => void;
}

export default function CadFileUpload({ projectId, initialPath, onUploadSuccess }: CadFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file) return;

    // Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['stl', 'step', 'stp', '3dm', 'obj', 'fbx', 'igs', 'iges'];
    if (!ext || !allowed.includes(ext)) {
      setError(`Only ${allowed.join(', ')} files are supported.`);
      return;
    }

    // Safety check for Vercel limits (even though we are using signed URLs, 
    // it's good practice to inform the user)
    const isLarge = file.size > 4.5 * 1024 * 1024;

    setIsUploading(true);
    setError(null);
    setUploadProgress(5);

    try {
      // 1. Get signed upload URL
      const signedRes = await getSignedUploadUrl(file.name, projectId);
      
      if (!signedRes.success || !signedRes.signedUrl) {
        throw new Error(signedRes.error || 'Failed to initialize secure upload.');
      }

      setUploadProgress(20);

      // 2. Perform direct upload via fetch
      const uploadResponse = await fetch(signedRes.signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Storage upload failed:', errorText);
        throw new Error('Storage server rejected the file. It might be too large or invalid.');
      }

      setUploadProgress(100);
      setCurrentPath(signedRes.path!);
      onUploadSuccess(signedRes.path!);
    } catch (err: any) {
      console.error('Upload failed:', err.message);
      setError(`${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="font-label text-[10px] font-black uppercase tracking-widest text-[#fce003] ml-1">
        3D Model Delivery (STL / STP / 3DM)
      </label>
      
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-500 flex flex-col items-center justify-center gap-3 ${
          isUploading ? 'border-[#fce003]/50 bg-[#fce003]/5' : 
          currentPath ? 'border-green-500/30 bg-green-500/5' : 
          'border-white/10 bg-white/[0.02] hover:border-[#fce003]/30 hover:bg-[#fce003]/[0.02]'
        }`}
      >
        {isUploading ? (
          <>
            <div className="w-10 h-10 border-2 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-[#fce003] uppercase tracking-widest">Uploading {uploadProgress}%</p>
            <p className="text-[8px] text-stone-500 uppercase font-bold tracking-tighter">Please wait for server response...</p>
          </>
        ) : currentPath ? (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-1">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-white mb-1 uppercase tracking-tight">Delivery Ready</p>
              <p className="text-[9px] text-stone-500 font-mono truncate max-w-[200px] bg-black/20 px-2 py-1 rounded">{currentPath.split('/').pop()}</p>
            </div>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[9px] font-black text-[#fce003] uppercase tracking-widest hover:underline mt-2 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[10px]">sync</span> Replace File
            </button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-[#fce003]/10 flex items-center justify-center text-[#fce003] mb-2 border border-[#fce003]/20 shadow-[0_0_15px_rgba(252,224,3,0.1)]">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-white mb-1 uppercase tracking-wide">Drag & Drop CAD File</p>
              <p className="text-[9px] text-stone-500 font-bold uppercase tracking-tight opacity-70">STL, STP, or 3DM formats</p>
            </div>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
            />
          </>
        )}
        
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".stl,.step,.stp,.3dm,.obj,.fbx,.igs,.iges"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 px-2">
          <span className="material-symbols-outlined text-xs">error</span>
          <span className="text-[9px] font-bold uppercase">{error}</span>
        </div>
      )}

      {/* Hidden input to ensure form-data captures the path */}
      <input type="hidden" name="cadFile" value={currentPath} />
    </div>
  );
}
