'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export const SidebarNav: React.FC = () => {
  const pathname = usePathname();
  const { isDesigner, isAuthenticated } = useAuth();
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!isAuthenticated) return null;


  const navItems = isDesigner ? [
    { label: 'Workstation', icon: 'dashboard', href: '/designer' },
    { label: 'Projects', icon: 'precision_manufacturing', href: '/projects' },
    { label: 'Inbox', icon: 'mail', href: '/inbox' },
    { label: 'Settings', icon: 'settings', href: '/settings' },
  ] : [
    { label: 'Home', icon: 'home', href: '/' },
    { label: 'Projects', icon: 'precision_manufacturing', href: '/projects' },
    { label: 'Team', icon: 'groups', href: '/team' },
    { label: 'Clients', icon: 'badge', href: '/clients' },
    { label: 'Inbox', icon: 'mail', href: '/inbox' },
    { label: 'Settings', icon: 'settings', href: '/settings' },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-surface-container-low flex-col border-r border-outline-variant/20 fixed left-0 top-0 h-screen z-[210]">
      <div className="p-6 flex flex-col gap-8 h-full">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[#fce003] shadow-lg shadow-yellow-400/5">
            <span className="material-symbols-outlined">grid_view</span>
          </div>
          <div className="flex flex-col -gap-1">
            <h1 className="font-headline font-extrabold text-lg text-[#fce003] tracking-tight uppercase leading-none">CADONCE</h1>
            <p className="text-white/40 text-[7px] font-black uppercase tracking-[0.3em] ml-0.5">
              {isDesigner ? 'Workstation' : 'Organization'}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  isActive 
                    ? 'bg-white/5 text-[#fce003]' 
                    : 'text-on-surface-variant hover:bg-white/[0.02] hover:text-white'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 electric-gradient shadow-[0_0_10px_rgba(252,224,3,0.5)]" />
                )}
                <span className={`material-symbols-outlined transition-transform duration-500 group-hover:scale-110 ${isActive ? 'fill-1' : ''}`} style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {item.icon}
                </span>
                <span className={`font-bold text-sm tracking-tight ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="ml-auto w-1 h-1 rounded-full bg-[#fce003] shadow-[0_0_8px_rgba(252,224,3,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Actions Section - Only for Organization Owners */}
        {!isDesigner && (
          <div className="pt-4 border-t border-outline-variant/10 flex flex-col gap-3">
            <Link 
              href="/projects/new"
              className="electric-gradient text-black font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(252,224,3,0.2)] active:scale-95 transition-all hover:brightness-110"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              <span className="text-xs uppercase tracking-widest">New Project</span>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
};
