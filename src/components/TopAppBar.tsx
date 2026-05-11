"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getDesignerStatus } from '@/app/actions';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationCenter } from '@/components/NotificationCenter';

export const TopAppBar: React.FC = () => {
  const { isAuthenticated, subscription, user, organizationName, availableOrganizations, activeOrganizationId, switchOrganization, isDesigner, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [points, setPoints] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  
  useEffect(() => {
    setHasMounted(true);
    if (isAuthenticated) {
      const fetchPoints = async () => {
        const { getMySettings } = await import('@/app/actions');
        const res = await getMySettings();
        if (res.success && res.settings) {
          setPoints(res.settings.pointsBalance || 0);
          setAvatarUrl(res.settings.avatarUrl || '');
        }
      };
      fetchPoints();
    }
  }, [isAuthenticated]);

  // Header is ready as soon as auth finishes loading OR we have a confirmed designer role (Instant Recognition)
  const isReady = hasMounted && (!authLoading || isDesigner);
  const isAdmin = !isDesigner;
  const showRoleUI = isReady;

  const planName = subscription?.plan || 'Free';
  const planColor = planName === 'Free' ? 'text-neutral-500' : 'text-yellow-400';

  return (
    <header 
      className={`fixed top-0 left-0 w-full md:left-64 md:w-[calc(100%-16rem)] z-[200] flex justify-between items-center px-6 h-16 ${isDesigner ? 'bg-[#0c0a04]/95 border-b border-white/5' : 'bg-[#0c0a04]/80 border-b border-white/5'} backdrop-blur-xl shadow-[0_4px_20px_rgba(252,224,3,0.05)] transition-all duration-300 opacity-100`}
    >

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Universal Back Button */}
        {isAuthenticated && pathname !== '/' && pathname !== '/designer' && (
          <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 text-[#fce003] hover:bg-white/5 rounded-full transition-all active:scale-95 group flex items-center justify-center relative"
            title="Navigate Back"
          >
            <span className="material-symbols-outlined text-2xl group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <div className="absolute -bottom-1 w-0 h-0.5 bg-[#fce003] group-hover:w-full transition-all duration-300" />
          </button>
        )}

        <div className="md:hidden flex items-center gap-1.5 sm:gap-3">
          <Link href={isDesigner ? "/designer" : "/"} className="flex items-center gap-3 active:scale-95 transition-transform">
            {(!isAuthenticated || pathname === '/' || pathname === '/designer') && (
              <span className="material-symbols-outlined text-[#fce003]">grid_view</span>
            )}
            <div className="flex flex-col -gap-1">
              <h1 className="font-headline font-extrabold tracking-tight uppercase text-[#fce003] text-lg sm:text-xl leading-none">CADONCE</h1>
            </div>
          </Link>
        </div>

        {/* Desktop Search Area */}
        <div className="hidden md:flex items-center gap-4">
          <div className="relative group">
            <span className="absolute inset-y-0 left-3.5 flex items-center text-on-surface-variant pointer-events-none">
              <span className="material-symbols-outlined text-[18px] group-focus-within:text-[#fce003] transition-colors">search</span>
            </span>
            <input 
              className="bg-white/[0.03] border border-white/5 rounded-2xl pl-11 pr-4 py-2 md:w-40 lg:w-80 text-[11px] font-bold text-white placeholder:text-neutral-500 focus:bg-white/[0.05] focus:ring-1 focus:ring-[#fce003]/20 focus:border-[#fce003]/30 outline-none transition-all duration-300" 
              placeholder="Search assets, projects, or designers..." 
              type="text"
            />

          </div>
        </div>

        {isAuthenticated && showRoleUI && !isDesigner && (
          <Link href="/pricing" className="hidden sm:flex ml-2 items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:border-yellow-400/30 transition-all active:scale-95 group">
            <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${planColor}`}>{planName}</span>
            <span className="material-symbols-outlined text-[10px] text-neutral-500 group-hover:text-yellow-400">workspace_premium</span>
          </Link>
        )}

        {/* Cadonce Points Beacon - Condensed for Mobile */}
        {isAuthenticated && (
          <Link href="/settings?tab=wallet" className="ml-1 sm:ml-2 flex items-center gap-1.5 h-8 px-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 hover:bg-yellow-400/20 transition-all active:scale-95 group relative overflow-hidden shrink-0">
             <div className="absolute inset-0 bg-yellow-400/5 animate-pulse" />
             <span className="material-symbols-outlined text-[12px] text-yellow-400 font-black animate-spin-slow">toll</span>
             <span className="text-[10px] font-black text-yellow-400 uppercase tracking-tighter tabular-nums">
               {points.toLocaleString()} <span className="hidden sm:inline text-[7px] opacity-70 ml-0.5">PTS</span>
             </span>
          </Link>
        )}

      </div>


      
      <div className="flex items-center gap-2 sm:gap-4">
        {/* User Info & Actions */}
        <div className="hidden lg:flex items-center gap-3 pr-4 border-r border-white/10">
          <div className="text-right">
            <p className="text-[10px] font-black text-white uppercase tracking-tighter">
              {isDesigner ? (user?.user_metadata?.fullName || 'Active Designer') : (organizationName || 'Organization')}
            </p>
            <p className="text-[7px] font-bold text-green-400 uppercase tracking-widest leading-none">Online</p>
          </div>
        </div>

        {isAuthenticated && (
          <div className="flex items-center gap-1.5">
            <NotificationCenter />
            
            <Link href={isDesigner ? "/designer/profile" : "/settings"} className="size-8 rounded-xl overflow-hidden border border-white/10 hover:border-[#fce003] transition-all cursor-pointer active:scale-95 group shrink-0">
              <img 
                alt="User Profile Avatar" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                src={avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${user?.email || 'CADONCE'}`}
              />
            </Link>
            
            <button 
              onClick={async () => {
                const { signOut } = await import('@/app/actions');
                await signOut();
                window.location.href = '/auth/login';
              }}
              className="size-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/30 transition-all flex items-center justify-center active:scale-90 shrink-0"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
