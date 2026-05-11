'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { sendChatMessage, getProjectMessages, markMessagesAsRead, uploadChatFile, getChatFileUrl, getSignedUploadUrl, deleteChatMessage } from '@/app/actions';

interface Message {
  id: string;
  project_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'organization' | 'designer';
  content: string;
  created_at: string;
  is_read: boolean;
}

interface ProjectChatProps {
  projectId: string;
  projectTitle: string;
}

export const ProjectChat: React.FC<ProjectChatProps> = ({ projectId, projectTitle }) => {
  const { user, isDesigner, organizationName } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState({ loaded: 0, total: 0 });
  const [tempFile, setTempFile] = useState<{ name: string; size: string } | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch History & Setup Realtime
  useEffect(() => {
    let isMounted = true;
    
    async function loadMessages() {
      setLoading(true);
      setMessages([]); // Immediate wipe to prevent ghost messages from previous project
      
      const data = await getProjectMessages(projectId);
      if (!isMounted) return;
      
      // Sort strictly by ISO string comparison for microsecond precision
      const sortedData = [...data].sort((a, b) => a.created_at.localeCompare(b.created_at));
      setMessages(sortedData);
      if (user) {
        await markMessagesAsRead(projectId, user.id);
      }
      setLoading(false);
    }
    loadMessages();

    // Set up polling for new messages - optimized with mounting check
    const interval = setInterval(async () => {
      const data = await getProjectMessages(projectId);
      if (!isMounted) return;
      
      if (data.length > messages.length) {
        const sortedData = [...data].sort((a, b) => a.created_at.localeCompare(b.created_at));
        setMessages(sortedData);
        if (user) {
          await markMessagesAsRead(projectId, user.id);
        }
      }
    }, 4000);

    // Setup Realtime Subscription
    const channel = supabase
      .channel(`project-chat-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          if (!isMounted) return;
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            const updated = [...prev, newMessage];
            return updated.sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
          
          if (newMessage.sender_id !== user?.id && user) {
            markMessagesAsRead(projectId, user.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          if (!isMounted) return;
          setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [projectId, user?.id]);

  // 2. Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 3. Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !user) return;

    const content = inputValue.trim();
    setInputValue(''); // Clear immediately for snappiness

    const senderName = isDesigner ? (user.user_metadata?.full_name || 'Designer') : (organizationName || 'Organization');
    const senderRole = isDesigner ? 'designer' : 'organization';

    const res = await sendChatMessage(projectId, content, senderName, senderRole);
    if (!res.success) {
      console.error('Failed to send message:', res.error);
      alert('Failed to send message: ' + res.error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    const res = await deleteChatMessage(messageId);
    if (res.success) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } else {
      alert('Failed to delete message: ' + res.error);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 1. Validation: Size (200MB)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('File size too large. Maximum limit is 200MB.');
      return;
    }

    // 2. Validation: Extension
    const supportedExts = ['3dm', 'stl', 'obj', 'png', 'jpg', 'jpeg'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !supportedExts.includes(fileExt)) {
      alert(`File not supported. Please upload: ${supportedExts.join(', ').toUpperCase()}`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadTotal({ loaded: 0, total: file.size });
    setTempFile({ name: file.name, size: (file.size / (1024 * 1024)).toFixed(2) + ' MB' });

    try {
      const signRes = await getSignedUploadUrl(file.name, projectId);
      
      if (!signRes.success || !signRes.signedUrl) {
        throw new Error(signRes.error || 'Failed to get upload signature');
      }

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signRes.signedUrl);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
          setUploadTotal({ loaded: event.loaded, total: event.total });
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const fileMessage = JSON.stringify({
            type: 'file',
            path: signRes.path,
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
          });
          
          const senderName = isDesigner ? (user.user_metadata?.full_name || 'Designer') : (organizationName || 'Organization');
          const senderRole = isDesigner ? 'designer' : 'organization';
          
          await sendChatMessage(projectId, fileMessage, senderName, senderRole);
          setIsUploading(false);
          setTempFile(null);
        } else {
          alert('Upload failed: ' + xhr.statusText);
          setIsUploading(false);
          setTempFile(null);
        }
      };

      xhr.onerror = () => {
        alert('Upload failed due to network error.');
        setIsUploading(false);
        setTempFile(null);
      };

      xhr.send(file);

    } catch (err: any) {
      alert('File upload error: ' + err.message);
      setIsUploading(false);
      setTempFile(null);
    } finally {
      e.target.value = '';
    }
  };

  const downloadFile = async (path: string, fileName: string) => {
    const res = await getChatFileUrl(path, fileName);
    if (res.success && res.url) {
      window.open(res.url, '_blank');
    } else {
      alert('Failed to generate download link: ' + res.error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-[#0c0a04]">
        {/* Skeleton Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 shimmer"></div>
            <div className="space-y-1.5">
              <div className="w-20 h-2 bg-white/5 rounded shimmer"></div>
              <div className="w-32 h-1.5 bg-white/5 rounded shimmer"></div>
            </div>
          </div>
        </div>
        
        {/* Skeleton Messages */}
        <div className="flex-1 p-6 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex flex-col ${i % 2 === 0 ? 'items-end' : 'items-start'}`}>
              <div className="w-16 h-1.5 bg-white/5 rounded mb-2 shimmer"></div>
              <div className={`h-12 w-48 bg-white/5 rounded-2xl ${i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'} shimmer`}></div>
            </div>
          ))}
        </div>

        {/* Skeleton Input */}
        <div className="p-4 border-t border-white/5 flex gap-3">
           <div className="w-10 h-10 rounded-xl bg-white/5 shimmer"></div>
           <div className="flex-1 h-10 rounded-xl bg-white/5 shimmer"></div>
           <div className="w-10 h-10 rounded-xl bg-white/5 shimmer"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0c0a04] shadow-2xl relative">
      {/* Chat Header - Sticky within Workstation (Snaps below Tabs) */}
      <div className="sticky top-0 z-30 px-6 py-4 border-b border-white/5 bg-[#0c0a04] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-yellow-400 text-sm">chat_bubble</span>
          </div>
          <div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Project Chat</h3>
            <p className="text-[8px] font-bold text-white/40 uppercase tracking-tighter truncate max-w-[150px]">
              {projectTitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
           <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
           <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 scroll-smooth scrollbar-thin scrollbar-thumb-white/10 overscroll-contain"
      >
        {messages.length === 0 && !tempFile && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
            <span className="material-symbols-outlined text-4xl mb-2">forum</span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Start the conversation</p>
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === user?.id;
          const showName = idx === 0 || messages[idx-1].sender_id !== msg.sender_id;
          const isNextSame = idx < messages.length - 1 && messages[idx+1].sender_id === msg.sender_id;

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative ${showName ? 'mt-6' : 'mt-1'}`}
              onClick={() => setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id)}
            >
              {!isDesigner && selectedMessageId === msg.id && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMessage(msg.id);
                  }}
                  className="absolute -top-3 -right-2 z-50 bg-[#FF2626] text-white rounded-lg p-1 shadow-2xl animate-in zoom-in duration-200 border border-white/20"
                  title="Delete message"
                >
                  <span className="material-symbols-outlined text-[12px]">delete</span>
                </button>
              )}
              {showName && (
                <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1 mx-1">
                  {isMe ? 'You' : msg.sender_name}
                </span>
              )}
              <div 
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[11px] leading-relaxed ${
                  isMe 
                    ? 'bg-yellow-400 text-black font-bold rounded-tr-none' 
                    : 'bg-white/5 text-white/90 border border-white/5 rounded-tl-none'
                }`}
              >
                {msg.content.startsWith('{"type":"file"') ? (
                  (() => {
                    try {
                      const fileInfo = JSON.parse(msg.content);
                      return (
                        <div className="flex items-center gap-3 p-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-black/10' : 'bg-yellow-400/20'}`}>
                            <span className={`material-symbols-outlined text-sm ${isMe ? 'text-black' : 'text-yellow-400'}`}>attach_file</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-black uppercase truncate ${isMe ? 'text-stone-950' : 'text-white'}`}>{fileInfo.name}</p>
                            <p className={`text-[8px] font-bold opacity-60 ${isMe ? 'text-black/60' : 'text-white/60'}`}>{fileInfo.size}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => downloadFile(fileInfo.path, fileInfo.name)}
                            className={`flex items-center justify-center p-1.5 rounded-md ${isMe ? 'bg-black/10 hover:bg-black/20' : 'bg-white/10 hover:bg-white/20'} transition-colors`}
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                          </button>
                        </div>
                      );
                    } catch (e) {
                      return msg.content;
                    }
                  })()
                ) : (
                  msg.content
                )}
                <div className={`text-[7px] mt-1 opacity-50 ${isMe ? 'text-black' : 'text-white/40'} text-right`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        {/* Temporary Uploading Message */}
        {tempFile && (
          <div className="flex flex-col items-end">
             <div className="bg-yellow-400/10 border border-yellow-400/20 p-4 rounded-2xl rounded-tr-none min-w-[200px]">
                <div className="flex items-center gap-3 mb-3">
                   <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-white uppercase truncate">
                        {(() => {
                          const name = tempFile.name;
                          const parts = name.split('.');
                          if (parts.length > 2 && parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()) {
                            return parts.slice(0, -1).join('.');
                          }
                          return name;
                        })()}
                      </p>
                      <p className="text-[8px] font-bold text-yellow-400/60 uppercase tracking-widest">{tempFile.size}</p>
                   </div>
                </div>
                <div className="space-y-1.5">
                   <div className="flex justify-between items-center">
                      <span className="text-[7px] font-black text-yellow-400 uppercase">Uploading</span>
                      <span className="text-[7px] font-black text-yellow-400 uppercase">{uploadProgress}%</span>
                   </div>
                   <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-400 transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                   </div>
                </div>
             </div>
             <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest mt-1 mr-2">Sending...</span>
          </div>
        )}
      </div>

      <div className="h-[120px] md:h-[80px]"></div> {/* Spacer for fixed/absolute input */}
      <form 
        onSubmit={handleSendMessage}
        className="fixed md:absolute bottom-[72px] md:bottom-0 left-0 md:left-0 w-full z-[150] md:z-10 p-4 bg-[#0c0a04] border-t border-white/5 flex items-center gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
      >
        <input 
          type="file"
          id="chat-file-input"
          className="hidden"
          accept=".3dm,.stl,.obj,image/png,image/jpeg,image/jpg"
          onChange={handleFileAttach}
        />
        <button 
          type="button"
          onClick={() => document.getElementById('chat-file-input')?.click()}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/40 flex items-center justify-center hover:text-white hover:border-white/20 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined">attach_file</span>
        </button>
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-yellow-400/50 transition-all"
        />
        <button 
          type="submit"
          disabled={!inputValue.trim()}
          className="w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center active:scale-90 transition-all disabled:opacity-50 disabled:grayscale"
        >
          <span className="material-symbols-outlined font-bold">send</span>
        </button>
      </form>
    </div>
  );
};
