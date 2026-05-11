// Mock service to simulate Amazon & Flipkart Product Search behavior
export type Platform = 'amazon' | 'flipkart';

export interface Product {
  id: string;
  asin?: string;
  title: string;
  price: number;
  oldPrice: number;
  discount: string;
  imageUrl: string;
  cashback: string;
  points?: number;
  platform: Platform;
  url: string;
  currency?: string;
  countryCode?: string;
}

const MOCK_DATA: Product[] = [];

export const searchProducts = async (query: string, platform: Platform): Promise<Product[]> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  if (!query) return MOCK_DATA.filter(p => p.platform === platform).slice(0, 2);
  
  const filtered = MOCK_DATA.filter(p => 
    p.platform === platform && 
    p.title.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    const keywords = encodeURIComponent(query.toLowerCase().split(' ').join(','));
    return [
      {
        id: Math.random().toString(),
        title: `${query.charAt(0).toUpperCase() + query.slice(1)} - ${platform === 'amazon' ? 'Amazon' : 'Flipkart'} Find`,
        price: 249.99,
        oldPrice: 299.99,
        discount: '15% OFF',
        imageUrl: `https://loremflickr.com/400/400/${keywords},tech`,
        cashback: platform === 'amazon' ? '2% CASHBACK' : '3% CASHBACK',
        platform: platform,
        url: platform === 'amazon' ? `https://www.amazon.in/s?k=${encodeURIComponent(query)}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`
      }
    ];
  }
  
  return filtered;
};
