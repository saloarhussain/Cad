'use client';

import React, { useState, useRef } from 'react';
import { getCloudinarySignature, updateProjectGallery } from '@/app/actions';

interface CloudinaryUploadProps {
  projectId?: string;
  onSuccess?: () => void;
  onUpload?: (url: string, type: 'image' | 'video') => void;
}

export const CloudinaryUpload: React.FC<CloudinaryUploadProps> = ({ projectId, onSuccess, onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // 1. Get signature from server
      const config = await getCloudinarySignature();
      if (!config) throw new Error('Failed to get upload signature');

      // 2. Prepare Form Data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', config.apiKey!);
      formData.append('timestamp', config.timestamp.toString());
      formData.append('signature', config.signature);
      
      const fileType = file.type.startsWith('video') ? 'video' : 'image';
      
      // 3. Upload to Cloudinary
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${config.cloudName}/${fileType}/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          const mediaUrl = response.secure_url;
          
          // 4. Handle Save/State
          if (onUpload) {
            onUpload(mediaUrl, fileType);
          }

          if (projectId) {
            const res = await updateProjectGallery(projectId, mediaUrl, fileType);
            setUploading(false); // Clear UI immediately
            if (res.success) {
              if (onSuccess) onSuccess();
            } else {
              alert('Upload successful but failed to save to project.');
            }
          } else {
             // If no projectId, we rely purely on onUpload
             setUploading(false); // Clear UI immediately
             if (onSuccess) onSuccess();
          }
        } else {
          console.error('Cloudinary Upload Failed:', xhr.responseText);
          alert('Upload to Cloudinary failed.');
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        console.error('XHR Error during upload');
        alert('An error occurred during the upload.');
        setUploading(false);
      };

      xhr.send(formData);

    } catch (err: any) {
      console.error('Upload Error:', err.message);
      alert(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*"
      />
      
      <button 
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`w-full group relative flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-8 hover:border-primary/40 transition-all duration-300 overflow-hidden ${uploading ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className="text-stone-800"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={175.9}
                  strokeDashoffset={175.9 - (175.9 * progress) / 100}
                  className="text-primary transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-black text-primary">
                {progress}%
              </div>
            </div>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">OPTIMIZING ASSETS...</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-primary/10">
              <span className="material-symbols-outlined text-primary text-2xl">cloud_upload</span>
            </div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Upload Media Assets</h4>
            <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-tighter">Photos, Renders, or Project Walkthroughs (Max 100MB)</p>
          </>
        )}
      </button>
    </div>
  );
};
