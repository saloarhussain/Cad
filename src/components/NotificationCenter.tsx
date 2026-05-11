'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions';

interface Notification {
  id: string;
  type: 'message' | 'annotation' | 'intake' | 'update';
  title: string;
  content: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const res = await getNotifications();
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.notifications?.filter(n => !n.is_read).length || 0);
      }
    };

    fetchNotifications();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Play subtle notification sound if possible
          try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.2;
            audio.play().catch(() => {}); // Browsers might block autoplay
          } catch (e) {}
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedNotif = payload.new as Notification;
          setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n));
          setUnreadCount(prev => Math.max(0, notifications.filter(n => !n.is_read).length));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    const res = await markNotificationAsRead(id);
    if (res.success) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    const res = await markAllNotificationsAsRead();
    if (res.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'message': return 'chat_bubble';
      case 'annotation': return '3d_rotation';
      case 'intake': return 'assignment_ind';
      case 'update': return 'sync';
      default: return 'notifications';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'message': return 'text-blue-400 bg-blue-400/10';
      case 'annotation': return 'text-orange-400 bg-orange-400/10';
      case 'intake': return 'text-purple-400 bg-purple-400/10';
      case 'update': return 'text-green-400 bg-green-400/10';
      default: return 'text-yellow-400 bg-yellow-400/10';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative size-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 group"
      >
        <span className="material-symbols-outlined text-xl text-white group-hover:text-yellow-400 transition-colors">
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 size-5 bg-[#FF2626] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0c0a04] animate-in zoom-in duration-300">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-16 mt-2 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[380px] bg-[#1a1a17] border border-white/10 rounded-2xl shadow-2xl z-[500] animate-in slide-in-from-top-4 fade-in duration-300 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Activity Feed</h3>
              <p className="text-[8px] font-bold text-white/40 uppercase mt-0.5">Real-time Project Updates</p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-[9px] font-black text-yellow-400 uppercase tracking-widest hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center opacity-20">
                <span className="material-symbols-outlined text-4xl mb-2">notifications_off</span>
                <p className="text-[10px] font-black uppercase tracking-widest">No activity yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  className={`relative p-4 border-b border-white/5 hover:bg-white/2 transition-colors group ${!notif.is_read ? 'bg-yellow-400/[0.02]' : ''}`}
                >
                  {!notif.is_read && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-1.5 w-1 h-8 bg-yellow-400 rounded-full"></div>
                  )}
                  <div className="flex gap-4">
                    <div className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 ${getTypeColor(notif.type)}`}>
                      <span className="material-symbols-outlined text-lg">{getTypeIcon(notif.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <Link 
                          href={notif.link || '#'} 
                          onClick={() => {
                            handleMarkAsRead(notif.id);
                            setIsOpen(false);
                          }}
                          className="text-[11px] font-black text-white hover:text-yellow-400 transition-colors uppercase tracking-tight truncate pr-2"
                        >
                          {notif.title}
                        </Link>
                        <span className="text-[8px] font-bold text-white/20 whitespace-nowrap">
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/50 leading-relaxed line-clamp-2 mb-2 font-medium">
                        {notif.content}
                      </p>
                      {!notif.is_read && (
                        <button 
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] hover:text-yellow-400 transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-white/2 border-t border-white/5 text-center">
            <Link 
              href="/notifications" 
              onClick={() => setIsOpen(false)}
              className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] hover:text-white transition-colors"
            >
              View Full History
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
