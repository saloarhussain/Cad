'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  organizationName: string | null;
  subscription: { plan: string; status: string } | null;
  isDesigner: boolean;
  role: 'undetermined' | 'organization' | 'designer';
  refreshSubscription: () => Promise<void>;
  availableOrganizations: { id: string; name: string }[];
  activeOrganizationId: string | null;
  switchOrganization: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{ plan: string; status: string } | null>(null);
  const [role, setRole] = useState<'undetermined' | 'organization' | 'designer'>('undetermined');
  const [availableOrganizations, setAvailableOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);

  const fetchSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data && 'subscription' in data && data.subscription) {
        setSubscription(data.subscription);
      } else {
        // Fallback for missing column or no record
        setSubscription({ plan: 'Free', status: 'active' });
      }
    } catch (err) {
      console.warn('Subscription fetch failed, falling back to Free plan:', err);
      setSubscription({ plan: 'Free', status: 'active' });
    }
  };

  const fetchDesignerStatus = async () => {
    try {
      const { getDesignerStatus } = await import('@/app/actions');
      const res = await getDesignerStatus();
      setRole(res.isDesigner ? 'designer' : 'organization');
      const organizations = res.organizations || [];
      setAvailableOrganizations(organizations);

      // Auto-select first organization if none selected or current one no longer available
      if (organizations.length > 0) {
        const currentStillAvailable = organizations.find(a => a.id === activeOrganizationId);
        if (!currentStillAvailable) {
          setActiveOrganizationId(organizations[0].id);
        }
      }
    } catch (err) {
      console.error('Designer status fetch failed:', err);
    }
  };

  useEffect(() => {
    // Intercept email verification redirect before rendering dashboard
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      const isSignup = hash.includes('type=signup') || search.includes('type=signup');
      
      if (isSignup && window.location.pathname !== '/auth/verified' && !session) {
        window.location.href = '/auth/verified' + search + hash;
        return;
      }
    }

    const handleDataInitialization = async (session: Session) => {
      try {
        setSession(session);
        setUser(session.user);
        setOrganizationName(session.user.user_metadata?.organization_name || null);
        
        // INSTANT RECOGNITION: Check metadata role immediately for speed
        const metadataRole = session.user.user_metadata?.role;
        if (metadataRole === 'designer') {
          setRole('designer');
        }

        const { getUserInitializationData } = await import('@/app/actions');
        const initData = await getUserInitializationData();

        if (initData) {
          setSubscription(initData.subscription);
          setOrganizationName(initData.organizationName);
          setRole(initData.designer.isDesigner ? 'designer' : 'organization');
          const organizations = initData.designer.organizations || [];
          setAvailableOrganizations(organizations);

          if (organizations.length > 0) {
            const currentStillAvailable = organizations.find(a => a.id === activeOrganizationId);
            if (!currentStillAvailable) {
              setActiveOrganizationId(organizations[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    const initializeAuth = async () => {
      // Safety release for the entire app initialization
      const safetyTimeout = setTimeout(() => {
        setLoading(prev => {
          if (prev) {
            console.warn('[AuthProvider] Auth initialization safety timeout triggered');
            return false;
          }
          return prev;
        });
      }, 5000); // Reduced to 5s for better UX

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          await handleDataInitialization(session);
        } else {
          // Check if there's an auth-related hash in the URL. 
          // If so, we should keep loading true because onAuthStateChange will soon fire.
          const hash = typeof window !== 'undefined' ? window.location.hash : '';
          const isAuthHash = hash.includes('access_token=') || 
                            hash.includes('type=invite') || 
                            hash.includes('type=recovery') || 
                            hash.includes('type=magiclink') || 
                            hash.includes('type=signup');
          
          if (!isAuthHash) {
            setLoading(false);
          } else {
            console.log('[AuthProvider] Auth hash detected, waiting for session event...');
            // Extra safety: if it's an auth hash, set a shorter timeout to release if event never fires
            setTimeout(() => {
               setLoading(prev => {
                 if (prev) {
                   console.warn('[AuthProvider] Hash detection safety timeout triggered');
                   return false;
                 }
                 return prev;
               });
            }, 3000);
          }
        }
      } catch (err) {
        console.error('initializeAuth Error:', err);
        setLoading(false);
      } finally {
        clearTimeout(safetyTimeout);
      }
    };


    initializeAuth();

    // Listen for changes on auth state
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // If it's a new sign in, show loading again to verify role
        if (event === 'SIGNED_IN') setLoading(true);
        await handleDataInitialization(session);
      } else {
        setSession(null);
        setUser(null);
        setOrganizationName(null);
        setSubscription(null);
        setRole('undetermined');
        setAvailableOrganizations([]);
        setActiveOrganizationId(null);
        setLoading(false);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAuthenticated: !!user,
      logout,
      organizationName,
      subscription,
      isDesigner: role === 'designer',
      role,
      refreshSubscription: () => user ? fetchSubscription(user.id) : Promise.resolve(),
      availableOrganizations,
      activeOrganizationId,
      switchOrganization: (id: string) => setActiveOrganizationId(id)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
