'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
  metalWeightImage?: string;
  braceletSize?: string;
  customLabel?: string;
  customValue?: string;
}

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single();
        
      if (data) {
        setProduct({
          ...data,
          cadFiles: data.cad_files || data.cadFiles,
          productType: data.product_type || data.productType,
          ringSize: data.ring_size || data.ringSize,
          mainGems: data.main_gems || data.mainGems,
          sideGems: data.side_gems || data.sideGems,
          metalWeight: data.metal_weight || data.metalWeight,
          metalWeightImage: data.metal_weight_image || data.metalWeightImage,
          braceletSize: data.bracelet_size || data.braceletSize,
          customLabel: data.custom_label || data.customLabel,
          customValue: data.custom_value || data.customValue,
        });
      } else if (error) {
        console.error('Failed to fetch product:', error);
      }
    };
    if (params.id) {
      loadProduct();
    }
  }, [params.id]);

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
        <span className="material-symbols-outlined text-5xl text-gray-600 mb-2">inventory_2</span>
        <p className="text-sm font-bold text-gray-400">Product not found.</p>
        <button 
          onClick={() => router.back()}
          className="mt-4 bg-[#1a1a1a] border border-[#262626] hover:bg-[#262626] text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 max-w-lg mx-auto w-full">
          <button onClick={() => router.back()} className="text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-sm font-bold truncate mx-4">{product.name}</h1>
          <button className="text-white">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {/* Main Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* Left Column: Image */}
          <div className="space-y-6">
            {/* Title Card */}
            <div className="relative rounded-xl overflow-hidden bg-[#121212] border border-[#262626]">
              <div className="aspect-square w-full">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 bg-gradient-to-t from-black to-transparent absolute bottom-0 left-0 right-0">
                <div className="inline-flex items-center gap-1.5 bg-[#ff4b4b] text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  Live Simulation
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight">{product.name}</h2>
                <p className="text-xl font-bold text-[#ffe30c] mt-1">{product.price}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Specs and Actions */}
          <div className="space-y-6 md:sticky md:top-20">
            {/* Product Specifications */}
            <div className="bg-[#121212] rounded-xl border border-[#262626] p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#ffe30c]">architecture</span>
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#ffe30c]">{product.productType || 'Product'} Specifications</h3>
              </div>
              <div className="space-y-4">
                {product.ringSize && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-medium">RING SIZE</span>
                    <span className="font-bold">{product.ringSize}</span>
                  </div>
                )}
                {product.mainGems && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-medium">MAIN GEMS</span>
                    <span className="font-bold">{product.mainGems}</span>
                  </div>
                )}
                {product.sideGems && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-medium">SIDE GEMS</span>
                    <span className="font-bold">{product.sideGems}</span>
                  </div>
                )}
                {product.metalWeight && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-medium">METAL WEIGHT</span>
                    <span className="font-bold">{product.metalWeight}</span>
                  </div>
                )}
                {product.braceletSize && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-medium">BRACELET SIZE</span>
                    <span className="font-bold">{product.braceletSize}</span>
                  </div>
                )}
                {product.customLabel && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-medium uppercase">{product.customLabel}</span>
                    <span className="font-bold">{product.customValue}</span>
                  </div>
                )}
                
                {/* Metal Weight Image */}
                {product.metalWeightImage && (
                  <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                    <span className="text-xs text-gray-500 font-medium block mb-2">METAL WEIGHT REFERENCE</span>
                    <div className="rounded-lg overflow-hidden border border-[#262626]">
                      <img src={product.metalWeightImage} alt="Metal Weight Reference" className="w-full h-auto" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 bg-[#0a0a0a] pt-2">
              <button className="w-full bg-[#ffe30c] hover:bg-[#e6cc00] text-black py-3.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-[#ffe30c]/10 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined font-bold">shopping_bag</span>
                Buy Now
              </button>
              <button className="w-full bg-gradient-to-r from-[#ffe30c] to-[#00ffff] hover:from-[#ffe30c] hover:to-[#00cccc] text-black py-3.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-[#ffe30c]/10 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined font-bold">download</span>
                Export CAD Package
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
