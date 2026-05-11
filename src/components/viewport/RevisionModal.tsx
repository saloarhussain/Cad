"use client";

import React, { useState } from 'react';
import { uploadCadFile, submitRevision } from '@/app/actions';

interface RevisionModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (label: string) => void;
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB

export default function RevisionModal({ projectId, isOpen, onClose, onSuccess }: RevisionModalProps) {
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const invalidFiles = selectedFiles.filter(f => f.size > MAX_FILE_SIZE);

    if (invalidFiles.length > 0) {
      setError(`File "${invalidFiles[0].name}" is too large. Each file should be under 500KB.`);
      return;
    }

    setError(null);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Please provide a note for the revision.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const uploadedFileUrls: string[] = [];

      // 1. Upload all files sequentially
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        const uploadResult = await uploadCadFile(formData);
        if (uploadResult.success && uploadResult.path) {
          uploadedFileUrls.push(uploadResult.path);
        } else {
          throw new Error(`Failed to upload ${file.name}: ${uploadResult.error}`);
        }
      }

      // 2. Submit revision record with all URLs
      const result = await submitRevision(projectId, note, uploadedFileUrls);
      if (result.success) {
        onSuccess(result.label!);
        onClose();
        setNote('');
        setFiles([]);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed top-16 bottom-20 left-0 right-0 z-[90] flex flex-col md:items-center md:justify-center md:p-6 overflow-y-auto bg-[#14120a] md:bg-transparent md:top-0 md:bottom-0">
      {/* Backdrop - Only visible on desktop */}
      <div
        className="hidden md:block fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative w-full min-h-full md:min-h-0 md:h-auto md:max-w-lg bg-[#14120a] md:border border-white/10 md:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-headline font-black text-white uppercase tracking-tight">Request Revision</h2>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Submit feedback to the design team</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-500 hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-yellow-400 uppercase tracking-widest ml-1">Notes & Instructions</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                rows={4}
                placeholder="Describe exactly what needs to be changed..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-neutral-700 focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/20 transition-all resize-none text-sm"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Reference Files (Max 500KB each)</label>
              <div className="space-y-3">
                {/* File List */}
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/10 border border-white/5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white">
                      <span className="truncate max-w-[120px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Upload Trigger */}
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="revision-files"
                  />
                  <label
                    htmlFor="revision-files"
                    className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 border-dashed rounded-2xl cursor-pointer hover:bg-white/10 transition-all group"
                  >
                    <span className="material-symbols-outlined text-neutral-500 group-hover:text-yellow-400">add_circle</span>
                    <span className="text-xs text-neutral-400">Add more files (jpg, png, stl)</span>
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-wider animate-shake">
                {error}
              </div>
            )}

            <div className="pt-4 flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl border border-white/5 text-white/50 font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 electric-gradient py-4 rounded-2xl text-black font-black uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    <span>Uploading...</span>
                  </div>
                ) : (
                  'Submit Revision'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
