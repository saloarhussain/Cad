'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  
  // Pages that should NEVER have sidebar padding (Auth, Setup, etc.)
  const isAuthPage = pathname?.startsWith('/auth');
  const isPublicPage = pathname === '/pricing'; // Add other public pages if needed
  
  // Only apply padding if authenticated and NOT on an auth/public page
  const shouldHavePadding = isAuthenticated && !isAuthPage && !isPublicPage;

  return (
    <main className={`${shouldHavePadding ? 'md:pl-64' : 'md:pl-0'} min-h-screen transition-all duration-500 ease-in-out bg-[#0c0a04]`}>
      {children}
    </main>
  );
}
