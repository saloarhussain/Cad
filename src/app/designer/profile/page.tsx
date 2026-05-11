"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import ViewportCanvas from '@/components/viewport/ViewportCanvas';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = error => reject(error);
  });
};

interface Product {
  id: number;
  name: string;
  price: string;
  image: string;
  images: string[];
  cadFiles: { name: string; size: number; url?: string; data?: ArrayBuffer }[];
  productType?: string;
  ringSize?: string;
  mainGems?: string;
  sideGems?: string;
  metalWeight?: string;
  metalWeightImage?: string | null;
  braceletSize?: string;
  customLabel?: string;
  customValue?: string;
  materialArchitecture?: {
    metalType: string;
    estWeight: string;
    surfaceFinish: string;
  };
  gemstoneInventory?: {
    centerStone: string;
    sideAccents: string;
  };
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <span className="material-symbols-outlined text-5xl text-red-500 mb-2">error</span>
          <p className="text-sm font-bold text-gray-400">Failed to load 3D model.</p>
          <p className="text-xs text-gray-600 mt-1">Please check the file or try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function DesignerProfile() {
  const { user } = useAuth();
  const [orgCount, setOrgCount] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [designer, setDesigner] = useState<any>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditingProductId, setCurrentEditingProductId] = useState<number | null>(null);
  const [selectedProductForView, setSelectedProductForView] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    price: '', 
    productType: 'Ring',
    image: '', // Keep for backward compatibility or fallback
    mainImage: null as File | null,
    galleryImages: [] as File[],
    cadFiles: [] as File[],
    metalWeightImage: null as File | null,
    ringSize: '',
    mainGems: '',
    sideGems: '',
    metalWeight: '',
    braceletSize: '',
    customLabel: '',
    customValue: ''
  });

  useEffect(() => {
    const loadData = async () => {
      if (user?.id) {
        const { readDb } = await import('@/lib/db');
        const db = await readDb(user.id);
        if (db.products && db.products.length > 0) {
          setProducts(db.products.map((p: any) => ({
            ...p,
            cadFiles: p.cad_files || p.cadFiles,
            productType: p.product_type || p.productType,
            ringSize: p.ring_size || p.ringSize,
            mainGems: p.main_gems || p.mainGems,
            sideGems: p.side_gems || p.sideGems,
            metalWeight: p.metal_weight || p.metalWeight,
            metalWeightImage: p.metal_weight_image || p.metalWeightImage,
            braceletSize: p.bracelet_size || p.braceletSize,
            customLabel: p.custom_label || p.customLabel,
            customValue: p.custom_value || p.customValue,
          })));
        }
        if (db.projects && db.projects.length > 0) {
          setProjects(db.projects);
        }
        if (db.designers && db.designers.length > 0) {
          setDesigner(db.designers[0]);
        } else if (user?.email) {
          console.log('[profile] Fetching designer by email:', user.email);
          const { getDesignerByEmail } = await import('@/app/actions');
          const res = await getDesignerByEmail(user.email);
          console.log('[profile] getDesignerByEmail result:', res);
          if (res.success && res.data) {
            setDesigner(res.data);
          }
        }
      }
    };
    loadData();
  }, [user?.id]);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'shop'>('portfolio');

  useEffect(() => {
    const fetchStatus = async () => {
      const { getDesignerStatus } = await import('@/app/actions');
      const status = await getDesignerStatus();
      setOrgCount(status.organizations?.length || 0);
    };
    fetchStatus();
  }, []);

  const handleShare = async () => {
    const publicUrl = `${window.location.origin}/portfolio/${user?.id}`;
    const shareData = {
      title: 'Check out my 3D Jewelry Portfolio',
      text: 'I create custom 3D jewelry designs. Check out my portfolio!',
      url: publicUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(publicUrl);
        alert('Portfolio link copied to clipboard!');
      } catch (err) {
        alert('Failed to copy link: ' + err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans antialiased pb-20">
        <style>{`
          @keyframes bonfire {
            0%, 100% { transform: scale(1) rotate(0deg); border-radius: 50%; opacity: 0.8; }
            25% { transform: scale(1.08, 1.05) rotate(3deg); border-radius: 40% 60% 50% 50%; opacity: 1; }
            50% { transform: scale(0.95, 1.1) rotate(-3deg); border-radius: 60% 40% 45% 55%; opacity: 0.9; }
            75% { transform: scale(1.05, 0.95) rotate(1deg); border-radius: 50% 50% 40% 60%; opacity: 1; }
          }
          .animate-bonfire {
            animation: bonfire 1.5s ease-in-out infinite;
          }
        `}</style>
        {/* MainContainer */}
        <div className="max-w-6xl mx-auto h-screen flex flex-col relative overflow-hidden">
          {/* TopHeader */}
          <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md px-4 py-3 flex justify-between items-center border-b border-[#262626]">
            <div className="flex gap-5">
              <button className="hover:text-[#ffe30c] transition-colors">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                </svg>
              </button>
              <button className="hover:text-[#ffe30c] transition-colors">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                </svg>
              </button>
            </div>
          </header>
          {/* END: TopHeader */}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 px-4 py-6 overflow-y-auto">
            <main className="col-span-1 md:col-span-8">
              {/* BEGIN: ProfileHeader Mobile Only */}
              <div className="block md:hidden">
                <section className="px-4 pt-8 pb-6 text-center" data-purpose="user-stats">
                  <div className="flex flex-col items-center mb-4">
                    {/* Profile Avatar with Bonfire Animation */}
                    <div className="relative w-24 h-24 mb-4">
                      {/* Outer Glowing Aura (Spreads outside and flickers) */}
                      <div className="absolute -inset-2 bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-400 animate-bonfire blur-[5px]"></div>
                      
                      {/* Sharp Border (Also flickers) */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-400 animate-bonfire"></div>
                      
                      {/* Inner Container */}
                      <div className="absolute inset-[3px] bg-[#0a0a0a] rounded-full p-0.5 flex items-center justify-center overflow-hidden">
                        {user?.user_metadata?.avatar_url ? (
                          <img 
                            alt="Profile Avatar" 
                            className="w-full h-full object-cover grayscale brightness-110" 
                            src={user.user_metadata.avatar_url} 
                          />
                        ) : (
                          <span className="material-symbols-outlined text-5xl text-gray-600">account_circle</span>
                        )}
                      </div>
                      {/* Status Indicator */}
                      <div className="absolute bottom-1 right-1 w-[22px] h-[22px] bg-[#23a55a] border-4 border-[#0a0a0a] rounded-full shadow-[0_0_10px_rgba(35,165,90,0.5)]"></div>
                    </div>
                    {/* Designer Name and Tag */}
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <h2 className="font-bold text-2xl tracking-tight">{designer?.fullName || user?.user_metadata?.fullName || 'anyx3d'}</h2>
                      <span className="material-symbols-outlined text-[#ff73fa] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
                    </div>
                    <div className="inline-flex items-center px-3 py-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 mt-1">
                      <span className="text-[#ffe30c] text-[10px] font-bold uppercase tracking-[0.15em]">Professional Designer</span>
                    </div>
                  </div>
                  
                  {/* Metrics Section with Subtle Dividers */}
                  <div className="grid grid-cols-3 border-y border-[#262626] py-4 mb-6">
                    <div className="border-r border-[#262626]">
                      <div className="font-bold text-lg">{products.length}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Posts</div>
                    </div>
                    <div className="border-r border-[#262626]">
                      <div className="font-bold text-lg">{orgCount}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Organizations</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">-<span className="text-sm font-normal text-gray-400 ml-0.5">/5</span></div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Rating</div>
                    </div>
                  </div>
                  
                  {/* Bio Text */}
                  <div className="mb-8">
                    <p className="text-sm text-gray-300 leading-relaxed max-w-[280px] mx-auto">{designer?.specialty || ''}</p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <Link href="/settings" className="flex-1 bg-[#121212] hover:bg-[#1e1e1e] border border-[#262626] py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors text-center">
                        Edit profile
                      </Link>
                      <Link href="/inbox" className="flex-1 bg-[#121212] hover:bg-[#1e1e1e] border border-[#262626] py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors text-center">
                        Hire Me
                      </Link>
                    </div>
                    <button 
                      onClick={handleShare}
                      className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[#121212] border border-[#262626] py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">share</span>
                      Share Portfolio
                    </button>
                  </div>
                </section>
              </div>
              {/* END: ProfileHeader Mobile Only */}

            {/* BEGIN: Tabs */}
            <section className="border-t border-[#262626] flex" data-purpose="gallery-tabs">
              <button 
                onClick={() => setActiveTab('portfolio')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${activeTab === 'portfolio' ? 'border-b-2 border-[#ffe30c] text-[#ffe30c]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`}
              >
                Portfolio
              </button>
              <button 
                onClick={() => setActiveTab('shop')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${activeTab === 'shop' ? 'border-b-2 border-[#ffe30c] text-[#ffe30c]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`}
              >
                Shop
              </button>
            </section>
            {/* END: Tabs */}

            {/* Content */}
            {activeTab === 'portfolio' ? (
              <section className="grid grid-cols-3 gap-0.5 bg-[#0a0a0a]" data-purpose="portfolio-showcase">
                {projects.length > 0 ? (
                  projects.flatMap(p => {
                    try {
                      const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
                      return Array.isArray(imgs) ? imgs : [];
                    } catch (e) {
                      return [];
                    }
                  }).map((img: any, idx: number) => (
                    <div key={idx} className="aspect-square relative overflow-hidden bg-[#0a0a0a]">
                      <img alt="Jewelry Project" className="w-full h-full object-cover" src={img.url || img} />
                      {img.type === 'video' && (
                        <div className="absolute top-2 right-2">
                          <span className="material-symbols-outlined text-white text-sm drop-shadow-md">videocam</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : null}
              </section>
            ) : (
              <div className="p-4 bg-[#0a0a0a]" data-purpose="shop-showcase">
                {/* Header with Add Product Button */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#ffe30c]">Your Shop</h3>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setCurrentEditingProductId(null);
                      setNewProduct({ name: '', price: '', productType: 'Ring', image: '', mainImage: null, galleryImages: [], cadFiles: [], metalWeightImage: null, ringSize: '', mainGems: '', sideGems: '', metalWeight: '', braceletSize: '', customLabel: '', customValue: '' });
                      setIsModalOpen(true);
                    }}
                    className="bg-[#ffe30c] hover:bg-[#e6cc00] text-black px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Add Product
                  </button>
                </div>

                {/* Products Table */}
                <div className="bg-[#121212] rounded-xl border border-[#262626] overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-500 uppercase bg-[#0a0a0a] border-b border-[#262626]">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50">
                          <td className="px-4 py-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded overflow-hidden bg-[#0a0a0a] border border-[#262626] flex-shrink-0">
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <div className="font-bold text-white cursor-pointer hover:text-[#ffe30c]" onClick={() => window.location.href = `/products/${product.id}`}>{product.name}</div>
                              <div className="flex gap-1 mt-0.5">
                                {product.images && product.images.length > 0 && (
                                  <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[10px]">image</span>
                                    {product.images.length}
                                  </span>
                                )}
                                {product.cadFiles && product.cadFiles.length > 0 && (
                                  <span className="text-[10px] text-[#ffe30c] flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[10px]">deployed_code</span>
                                    {product.cadFiles.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#ffe30c] font-bold">{product.price}</td>
                          <td className="px-4 py-3 text-white">{(product as any).productType || 'N/A'}</td>
                          <td className="px-4 py-3 text-xs space-y-0.5">
                            {(product as any).ringSize && <div><span className="text-gray-500">Size:</span> {(product as any).ringSize}</div>}
                            {(product as any).mainGems && <div><span className="text-gray-500">Gems:</span> {(product as any).mainGems}</div>}
                            {(product as any).metalWeight && <div><span className="text-gray-500">Weight:</span> {(product as any).metalWeight}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setIsEditing(true);
                                  setCurrentEditingProductId(product.id);
                                  setNewProduct({
                                    name: product.name,
                                    price: product.price,
                                    image: product.image,
                                    metalWeightImage: null,
                                    mainImage: null,
                                    galleryImages: [],
                                    cadFiles: [],
                                    productType: (product as any).productType || 'Ring',
                                    ringSize: (product as any).ringSize || '',
                                    mainGems: (product as any).mainGems || '',
                                    sideGems: (product as any).sideGems || '',
                                    metalWeight: (product as any).metalWeight || '',
                                    braceletSize: (product as any).braceletSize || '',
                                    customLabel: (product as any).customLabel || '',
                                    customValue: (product as any).customValue || ''
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="bg-[#ffe30c] hover:bg-[#e6cc00] text-black px-2.5 py-1 rounded text-xs font-bold transition-colors"
                              >
                                Edit
                              </button>
                              {product.cadFiles && product.cadFiles.length > 0 && (
                                <button 
                                  onClick={() => setSelectedProductForView(product)}
                                  className="bg-[#1a1a1a] border border-[#262626] hover:bg-[#262626] text-white px-2.5 py-1 rounded text-xs font-bold transition-colors flex items-center gap-0.5"
                                >
                                  <span className="material-symbols-outlined text-sm">view_in_ar</span>
                                  View 3D
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
          
          {/* Right Sidebar for Desktop */}
          <aside className="hidden md:block col-span-1 md:col-span-4 space-y-6 sticky top-24 self-start">
            {/* Profile Info Card (Desktop Only) */}
            <div className="bg-[#121212] rounded-xl border border-[#262626] p-6 text-center">
              {/* Profile Avatar */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative w-24 h-24 mb-4">
                  {/* Outer Glowing Aura (Spreads outside and flickers) */}
                  <div className="absolute -inset-2 bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-400 animate-bonfire blur-[5px]"></div>
                  
                  {/* Sharp Border (Also flickers) */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-400 animate-bonfire"></div>
                  
                  {/* Inner Container */}
                  <div className="absolute inset-[3px] bg-[#0a0a0a] rounded-full p-0.5 flex items-center justify-center overflow-hidden">
                    {user?.user_metadata?.avatar_url ? (
                      <img 
                        alt="Profile Avatar" 
                        className="w-full h-full object-cover grayscale brightness-110" 
                        src={user.user_metadata.avatar_url} 
                      />
                    ) : (
                      <span className="material-symbols-outlined text-5xl text-gray-600">account_circle</span>
                    )}
                  </div>
                  {/* Status Indicator */}
                  <div className="absolute bottom-1 right-1 w-[22px] h-[22px] bg-[#23a55a] border-4 border-[#0a0a0a] rounded-full shadow-[0_0_10px_rgba(35,165,90,0.5)]"></div>
                </div>
                {/* Designer Name and Tag */}
                <div className="flex items-center justify-center gap-1 mb-1">
                  <h2 className="font-bold text-2xl tracking-tight">{designer?.fullName || user?.user_metadata?.fullName || 'anyx3d'}</h2>
                  <span className="material-symbols-outlined text-[#ff73fa] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
                </div>
                <div className="inline-flex items-center px-3 py-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 mt-1">
                  <span className="text-[#ffe30c] text-[10px] font-bold uppercase tracking-[0.15em]">Professional Designer</span>
                </div>
              </div>
              
              {/* Metrics Section with Subtle Dividers */}
              <div className="grid grid-cols-3 border-y border-[#262626] py-4 mb-6">
                <div className="border-r border-[#262626]">
                  <div className="font-bold text-lg">{products.length}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Posts</div>
                </div>
                <div className="border-r border-[#262626]">
                  <div className="font-bold text-lg">{orgCount}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Organizations</div>
                </div>
                <div>
                  <div className="font-bold text-lg">-<span className="text-sm font-normal text-gray-400 ml-0.5">/5</span></div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Rating</div>
                </div>
              </div>
              
              {/* Bio Text */}
              <div className="mb-8">
                <p className="text-sm text-gray-300 leading-relaxed max-w-[280px] mx-auto">{designer?.specialty || ''}</p>
              </div>
              
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      {user && (
                        <Link href="/settings" className="flex-1 bg-[#121212] hover:bg-[#1e1e1e] border border-[#262626] py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors text-center">
                          Edit profile
                        </Link>
                      )}
                      <Link href="/inbox" className="flex-1 bg-[#121212] hover:bg-[#1e1e1e] border border-[#262626] py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors text-center">
                        Hire Me
                      </Link>
                    </div>
                    <button 
                      onClick={handleShare}
                      className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[#121212] border border-[#262626] py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">share</span>
                      Share Portfolio
                    </button>
                  </div>
            </div>

            {/* Skills & Tools */}
            <div className="bg-[#121212] rounded-xl border border-[#262626] p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#ffe30c] mb-4">Skills & Tools</h3>
              <div className="flex flex-wrap gap-2">
                {designer?.skills?.length > 0 ? (
                  designer.skills.map((skill: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-[#1a1a1a] rounded-lg text-xs font-semibold border border-[#262626]">{skill}</span>
                  ))
                ) : (
                  <span className="text-xs text-gray-600">No skills listed</span>
                )}
              </div>
            </div>

            {/* Client Reviews */}
            <div className="bg-[#121212] rounded-xl border border-[#262626] p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#ffe30c] mb-4">Client Reviews</h3>
              <div className="space-y-4">
                <p className="text-xs text-gray-500 text-center">No reviews yet.</p>
              </div>
            </div>
          </aside>
        </div>
        
        {/* Modal for Adding Product */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#121212] rounded-xl border border-[#262626] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{isEditing ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Product Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                    placeholder="Enter product name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Price</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                    placeholder="e.g. $500"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                  />
                </div>

                {/* Product Specifications */}
                <div className="pt-2 border-t border-[#262626]">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#ffe30c] mb-2">Product Specifications</h4>
                  
                  {/* Product Type Dropdown */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 block mb-1">Product Type</label>
                    <select 
                      className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c] text-white"
                      value={newProduct.productType}
                      onChange={(e) => setNewProduct({...newProduct, productType: e.target.value})}
                    >
                      <option value="Ring">Ring</option>
                      <option value="Pendant">Pendant</option>
                      <option value="Earring">Earring</option>
                      <option value="Bracelet">Bracelet</option>
                    </select>
                  </div>

                  {/* Conditional Fields based on Product Type */}
                  {newProduct.productType === 'Ring' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Ring Size</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. US 7"
                          value={newProduct.ringSize}
                          onChange={(e) => setNewProduct({...newProduct, ringSize: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Main Gems</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. 1.2ct Radiant"
                          value={newProduct.mainGems}
                          onChange={(e) => setNewProduct({...newProduct, mainGems: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Side Gems</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. 42x Round"
                          value={newProduct.sideGems}
                          onChange={(e) => setNewProduct({...newProduct, sideGems: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Metal Weight</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. 12.45g"
                          value={newProduct.metalWeight}
                          onChange={(e) => setNewProduct({...newProduct, metalWeight: e.target.value})}
                        />
                        <div className="mt-2">
                          <label className="text-xs text-gray-400 block mb-1">Metal Weight Image (Optional)</label>
                          <input 
                            type="file" 
                            accept="image/*"
                            className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                            onChange={(e) => setNewProduct({...newProduct, metalWeightImage: e.target.files?.[0] || null})}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {newProduct.productType === 'Bracelet' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Bracelet Size</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. 7 inches"
                          value={newProduct.braceletSize}
                          onChange={(e) => setNewProduct({...newProduct, braceletSize: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Main Gems</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. 5ct Tennis"
                          value={newProduct.mainGems}
                          onChange={(e) => setNewProduct({...newProduct, mainGems: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  {(newProduct.productType === 'Pendant' || newProduct.productType === 'Earring') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Main Gems</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. 1ct Diamond"
                          value={newProduct.mainGems}
                          onChange={(e) => setNewProduct({...newProduct, mainGems: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Metal Weight</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                          placeholder="e.g. 5g"
                          value={newProduct.metalWeight}
                          onChange={(e) => setNewProduct({...newProduct, metalWeight: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Field (Always shown for flexibility) */}
                  <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                    <label className="text-xs text-gray-400 block mb-1">Custom Field (Label: Value)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                        placeholder="Label (e.g. Chain Length)"
                        value={newProduct.customLabel}
                        onChange={(e) => setNewProduct({...newProduct, customLabel: e.target.value})}
                      />
                      <input 
                        type="text" 
                        className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                        placeholder="Value (e.g. 18 inches)"
                        value={newProduct.customValue}
                        onChange={(e) => setNewProduct({...newProduct, customValue: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Main Image</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewProduct({...newProduct, mainImage: file});
                      }
                    }}
                  />
                  {newProduct.mainImage ? (
                    <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-[#262626]">
                      <img 
                        src={URL.createObjectURL(newProduct.mainImage)} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : isEditing && newProduct.image ? (
                    <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-[#262626]">
                      <img 
                        src={newProduct.image} 
                        alt="Existing" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Gallery Images</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    multiple
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setNewProduct({...newProduct, galleryImages: [...newProduct.galleryImages, ...files]});
                    }}
                  />
                  {newProduct.galleryImages.length > 0 ? (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {newProduct.galleryImages.map((file, idx) => (
                        <div key={idx} className="w-10 h-10 rounded overflow-hidden border border-[#262626] relative group">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                          <button 
                            onClick={() => setNewProduct({...newProduct, galleryImages: newProduct.galleryImages.filter((_, i) => i !== idx)})} 
                            className="absolute top-0 right-0 bg-black/70 text-white text-xs w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : isEditing && (products.find(p => p.id === currentEditingProductId)?.images?.length ?? 0) > 0 ? (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {products.find(p => p.id === currentEditingProductId)?.images?.map((img: string, idx: number) => (
                        <div key={idx} className="w-10 h-10 rounded overflow-hidden border border-[#262626]">
                          <img 
                            src={img} 
                            alt="Existing" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">CAD Files (.3dm, .obj, .stl)</label>
                  <input 
                    type="file" 
                    accept=".3dm,.obj,.stl"
                    multiple
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#ffe30c]" 
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setNewProduct({...newProduct, cadFiles: [...newProduct.cadFiles, ...files]});
                    }}
                  />
                  {newProduct.cadFiles.length > 0 ? (
                    <div className="flex flex-col gap-1 mt-2">
                      {newProduct.cadFiles.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#1a1a1a] p-1.5 rounded text-xs text-gray-300">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button 
                            onClick={() => setNewProduct({...newProduct, cadFiles: newProduct.cadFiles.filter((_, i) => i !== idx)})} 
                            className="text-gray-500 hover:text-white"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : isEditing && (products.find(p => p.id === currentEditingProductId)?.cadFiles?.length ?? 0) > 0 ? (
                    <div className="flex flex-col gap-1 mt-2">
                      {products.find(p => p.id === currentEditingProductId)?.cadFiles?.map((file: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-[#1a1a1a] p-1.5 rounded text-xs text-gray-300">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <span className="text-gray-500 text-xs">(Already Uploaded)</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button 
                  onClick={async () => {
                    if (!newProduct.name || !newProduct.price || (!isEditing && !newProduct.mainImage)) {
                      alert('Please fill Name, Price, and select a Main Image!');
                      return;
                    }
                    
                    let mainImageUrl = newProduct.image;
                    if (newProduct.mainImage) {
                      try {
                        mainImageUrl = await fileToBase64(newProduct.mainImage);
                      } catch (err) {
                        console.error('Failed to convert image:', err);
                        alert('Failed to process image file.');
                        return;
                      }
                    }

                    try {
                      if (isEditing && currentEditingProductId) {
                        const updatedProducts = await Promise.all(products.map(async p => {
                          if (p.id === currentEditingProductId) {
                            const newCadFiles = newProduct.cadFiles.length > 0 
                              ? await Promise.all(newProduct.cadFiles.map(async f => ({ name: f.name, size: f.size, data: await fileToArrayBuffer(f) })))
                              : p.cadFiles;
                              
                            const newGalleryImages = newProduct.galleryImages.length > 0
                              ? await Promise.all(newProduct.galleryImages.map(f => fileToBase64(f)))
                              : p.images;

                             return {
                              ...p,
                              name: newProduct.name,
                              price: newProduct.price,
                              image: mainImageUrl,
                              images: newGalleryImages,
                              cadFiles: newCadFiles,
                              productType: newProduct.productType,
                              ringSize: newProduct.ringSize,
                              mainGems: newProduct.mainGems,
                              sideGems: newProduct.sideGems,
                              metalWeight: newProduct.metalWeight,
                              metalWeightImage: newProduct.metalWeightImage ? await fileToBase64(newProduct.metalWeightImage) : (p as any).metalWeightImage,
                              braceletSize: newProduct.braceletSize,
                              customLabel: newProduct.customLabel,
                              customValue: newProduct.customValue
                            };
                          }
                          return p;
                        }));
                        
                        setProducts(updatedProducts);

                        if (user?.id) {
                          const { updateRecord } = await import('@/lib/db');
                          const updatedProduct = updatedProducts.find(p => p.id === currentEditingProductId);
                          if (updatedProduct) {
                            const { id } = updatedProduct;
                            const dataToUpdate = {
                              name: updatedProduct.name,
                              price: updatedProduct.price,
                              image: updatedProduct.image,
                              images: updatedProduct.images,
                              cad_files: updatedProduct.cadFiles,
                              product_type: updatedProduct.productType,
                              ring_size: updatedProduct.ringSize,
                              main_gems: updatedProduct.mainGems,
                              side_gems: updatedProduct.sideGems,
                              metal_weight: updatedProduct.metalWeight,
                              metal_weight_image: updatedProduct.metalWeightImage,
                              bracelet_size: updatedProduct.braceletSize,
                              custom_label: updatedProduct.customLabel,
                              custom_value: updatedProduct.customValue
                            };
                            await updateRecord('products', String(id), dataToUpdate, user.id);
                          }
                        }
                      } else {
                        const newProd = {
                          id: Date.now(),
                          name: newProduct.name,
                          price: newProduct.price,
                          image: mainImageUrl,
                          images: await Promise.all(newProduct.galleryImages.map(f => fileToBase64(f))),
                          cadFiles: await Promise.all(newProduct.cadFiles.map(async f => ({ name: f.name, size: f.size, data: await fileToArrayBuffer(f) }))),
                          productType: newProduct.productType,
                          ringSize: newProduct.ringSize,
                          mainGems: newProduct.mainGems,
                          sideGems: newProduct.sideGems,
                          metalWeight: newProduct.metalWeight,
                          metalWeightImage: newProduct.metalWeightImage ? await fileToBase64(newProduct.metalWeightImage) : null,
                          braceletSize: newProduct.braceletSize,
                          customLabel: newProduct.customLabel,
                          customValue: newProduct.customValue
                        };
                        setProducts([...products, newProd]);

                        if (user?.id) {
                          const { supabase } = await import('@/lib/supabase');
                          const { data, error } = await supabase
                            .from('products')
                            .insert({
                              user_id: user.id,
                              name: newProd.name,
                              price: newProd.price,
                              image: newProd.image,
                              images: newProd.images,
                              cad_files: newProd.cadFiles,
                              product_type: newProd.productType,
                              ring_size: newProd.ringSize,
                              main_gems: newProd.mainGems,
                              side_gems: newProd.sideGems,
                              metal_weight: newProd.metalWeight,
                              metal_weight_image: newProd.metalWeightImage,
                              bracelet_size: newProd.braceletSize,
                              custom_label: newProd.customLabel,
                              custom_value: newProd.customValue
                            })
                            .select();
                            
                          if (error) throw error;
                          if (data?.[0]) {
                            setProducts(prev => prev.map(p => p.id === newProd.id ? { ...p, id: data[0].id } : p));
                          }
                        }
                      }

                      setNewProduct({ name: '', price: '', productType: 'Ring', image: '', mainImage: null, galleryImages: [], cadFiles: [], metalWeightImage: null, ringSize: '', mainGems: '', sideGems: '', metalWeight: '', braceletSize: '', customLabel: '', customValue: '' });
                      setIsEditing(false);
                      setCurrentEditingProductId(null);
                      setIsModalOpen(false);
                    } catch (err) {
                      console.error('Failed to save product:', err);
                      alert('Failed to save product: ' + (err as any).message);
                    }
                  }}
                  className="w-full bg-[#ffe30c] hover:bg-[#e6cc00] text-black py-2.5 rounded-lg text-sm font-bold transition-colors mt-6"
                >
                  {isEditing ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewport Modal */}
        {selectedProductForView && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#121212] rounded-xl border border-[#262626] w-full max-w-2xl relative h-[600px] overflow-hidden">
              {/* Canvas filling the whole thing */}
              <div className="absolute inset-0">
                {selectedProductForView.cadFiles && selectedProductForView.cadFiles.length > 0 ? (
                  <ErrorBoundary>
                    {(() => {
                      const supportedFile = selectedProductForView.cadFiles.find((f: any) => 
                        f.name.toLowerCase().endsWith('.stl') || 
                        f.name.toLowerCase().endsWith('.obj')
                      ) || selectedProductForView.cadFiles[0];
                      
                      return (
                        <ViewportCanvas 
                          fileUrl={supportedFile.url} 
                          fileName={supportedFile.name}
                          fileData={supportedFile.data}
                          metalType="gold" 
                          isAutoRotate={true}
                        />
                      );
                    })()}
                  </ErrorBoundary>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="material-symbols-outlined text-5xl text-gray-600 mb-2">view_in_ar</span>
                    <p className="text-sm font-bold text-gray-400">No CAD files available for preview.</p>
                  </div>
                )}
              </div>
              
              {/* Header Overlay */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-xl font-bold">{selectedProductForView.name}</h3>
                  <p className="text-xs text-gray-400">3D Viewport Preview</p>
                </div>
                <button onClick={() => setSelectedProductForView(null)} className="text-gray-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              {/* Footer Overlay */}
              <div className="absolute bottom-4 right-4 z-10">
                <button 
                  onClick={() => setSelectedProductForView(null)}
                  className="bg-[#ffe30c] hover:bg-[#e6cc00] text-black py-2 px-6 rounded-lg text-sm font-bold transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
  );
}
