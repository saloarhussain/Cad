"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getDb, getDesignerStatus } from '@/app/actions';
import dynamic from 'next/dynamic';
import { GLOBAL_CURRENCIES } from '@/lib/config';

const DashboardContent = dynamic(() => import('./DashboardContent'), { 
  ssr: false,
  loading: () => null 
});

export default function DashboardPage() {
  const [filterMode, setFilterMode] = useState<'day' | 'month' | 'year' | 'custom'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpense: 0,
    pendingRevenue: 0,
    activeProjects: 0,
    totalClients: 0,
    totalDesigners: 0,
    payoutsDue: 0,
    payoutsDueCount: 0,
    currency: '₹'
  });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();
  const { isAuthenticated, user, isDesigner, loading: authLoading } = useAuth();

  useEffect(() => {
    setHasMounted(true);
  }, []);

    useEffect(() => {
      if (hasMounted && !authLoading && isAuthenticated && isDesigner) {
        router.replace('/designer');
      }
      // Redirect to login if not authenticated (ONLY if not an invitation)
      if (hasMounted && !authLoading && !isAuthenticated) {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('email')) {
          router.replace('/auth/login');
        }
      }
    }, [isAuthenticated, isDesigner, authLoading, hasMounted, router]);

  const [allRates, setAllRates] = useState<Record<string, number>>({ USD: 1, INR: 83.5 });
  const [displayCurrency, setDisplayCurrency] = useState('₹');
  const [ratesLoaded, setRatesLoaded] = useState(false);

  useEffect(() => {
    // Load preferred currency from local storage
    const saved = localStorage.getItem('cadonce_dashboard_currency');
    if (saved) {
      setDisplayCurrency(saved);
    }

    const fetchRates = async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data.rates) {
          setAllRates(data.rates);
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates", err);
      } finally {
        setRatesLoaded(true);
      }
    };
    fetchRates();
  }, []);

  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || authLoading || isDesigner || !hasMounted) {
      return;
    }

    const fetchData = async () => {
      if (isInitialLoad) setLoading(true);
      
      // Safety timeout to prevent permanent loading state
      const safetyTimeout = setTimeout(() => {
        if (isInitialLoad) {
          console.warn('Dashboard data fetch exceeded 5s safety limit');
          setLoading(false);
          setIsInitialLoad(false);
        }
      }, 5000);

      try {
        const db = await getDb();
        const projects = db.projects || [];
        const clients = db.clients || [];
        const designers = db.designers || [];

        // Helper to convert to display currency
        const convert = (amount: number, fromSymbol: string) => {
          const fromCurrency = GLOBAL_CURRENCIES.find(c => c.symbol === fromSymbol)?.code || 'USD';
          const targetCurrency = GLOBAL_CURRENCIES.find(c => c.symbol === displayCurrency)?.code || 'INR';

          if (fromCurrency === targetCurrency) return amount;
          
          const rateFrom = allRates[fromCurrency] || 1;
          const rateTarget = allRates[targetCurrency] || 1;

          // Convert source to USD first, then to target
          return (amount / rateFrom) * rateTarget;
        };

        const filtered = projects.filter((p: any) => {
          if (!p.createdAt) return false;
          const pDate = new Date(p.createdAt);
          
          if (filterMode === 'day') {
            return pDate.toDateString() === selectedDate.toDateString();
          }
          if (filterMode === 'month') {
            return pDate.getMonth() === selectedDate.getMonth() && pDate.getFullYear() === selectedDate.getFullYear();
          }
          if (filterMode === 'year') {
            return pDate.getFullYear() === selectedDate.getFullYear();
          }
          if (filterMode === 'custom') {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return pDate >= start && pDate <= end;
          }
          return false;
        });

        setFilteredProjects(filtered);

        // Financial stats with proper conversion
        const totalRevenue = filtered.reduce((sum: number, p: any) => 
          sum + convert(parseFloat(p.revenue || '0'), p.revenueCurrency || '$'), 0);
        
        const totalExpense = filtered.reduce((sum: number, p: any) => 
          sum + convert(parseFloat(p.expense || '0'), p.expenseCurrency || '₹'), 0);
        
        const pendingRevenue = projects
          .filter((p: any) => {
            const s = p.status?.toLowerCase() || '';
            return !s.includes('complete') && !s.includes('done') && !s.includes('delivered');
          })
          .reduce((sum: number, p: any) => 
            sum + convert(parseFloat(p.revenue || '0'), p.revenueCurrency || '$'), 0);

        const activeProjectsCount = projects.filter((p: any) => {
          const s = p.status?.toLowerCase() || '';
          return !s.includes('complete') && !s.includes('done');
        }).length;

        const payoutsDueProjects = projects.filter((p: any) => {
          const s = p.status?.toLowerCase() || '';
          const isComplete = s.includes('complete') || s.includes('done') || s.includes('delivered');
          return isComplete && p.paymentStatus !== 'Paid';
        });

        const payoutsDue = payoutsDueProjects.reduce((sum: number, p: any) => 
          sum + convert(parseFloat(p.expense || '0'), p.expenseCurrency || '₹'), 0);

        setStats({
          totalRevenue,
          totalExpense,
          pendingRevenue,
          activeProjects: activeProjectsCount,
          totalClients: clients.length,
          totalDesigners: designers.length,
          payoutsDue,
          payoutsDueCount: payoutsDueProjects.length,
          currency: displayCurrency
        });

        setRecentProjects(projects.slice(0, 3));
        setAllProjects(projects);

        const withDeadlines = projects
          .filter((p: any) => p.deadlineDate && new Date(p.deadlineDate).getTime() > Date.now())
          .sort((a: any, b: any) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime())
          .slice(0, 4);
        setUpcomingDeadlines(withDeadlines);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        clearTimeout(safetyTimeout);
        setLoading(false);
        setIsInitialLoad(false);
      }
    };
    fetchData();
  }, [isAuthenticated, authLoading, isDesigner, hasMounted, filterMode, selectedDate, startDate, endDate, displayCurrency, allRates]);


  if (!hasMounted || authLoading || isInitialLoad || !ratesLoaded) {
    return (
      <div className="min-h-screen bg-[#161308] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#fce003] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black text-[#fce003] uppercase tracking-[0.3em] animate-pulse">Initializing Studio...</span>
        </div>
      </div>
    );
  }

  // If we reach here and aren't authenticated or are a designer, the useEffect above will handle the redirect.
  // We return null to avoid flashing the dashboard content.
  if (!isAuthenticated || isDesigner) return null;

  return (
    <DashboardContent 
      stats={stats}
      recentProjects={recentProjects}
      filteredProjects={filteredProjects}
      allProjects={allProjects}
      upcomingDeadlines={upcomingDeadlines}
      planName={stats.totalRevenue > 5000 ? 'Pro' : 'Free'}
      planColor={stats.totalRevenue > 5000 ? 'text-yellow-400' : 'text-neutral-500'}
      filterMode={filterMode}
      setFilterMode={setFilterMode}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      startDate={startDate}
      setStartDate={setStartDate}
      endDate={endDate}
      setEndDate={setEndDate}
    />
  );

}
