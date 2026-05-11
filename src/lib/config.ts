/**
 * GLOBAL PLATFORM CONFIGURATION (CADONCE FOUNDER SETTINGS)
 * These settings are managed by the platform owner (You).
 */
export const PLATFORM_CONFIG = {
  // The percentage taken from Designer payouts
  COMMISSION_RATE: 5, 
  
  // Platform Owner's Razorpay Keys (Where commissions are collected)
  RAZORPAY_KEY_ID: 'rzp_test_SkpDwr5coLX8wd', 
  RAZORPAY_KEY_SECRET: 'PSml4tkN9NhHZtonfJ9RbGsu',
  
  // Platform Owner's Wallet for manual settlements
  FOUNDER_ESCROW_WALLET: 'cadonce.treasury@paypal.com', // Replace with your ID
  
  // Platform Display Name
  PLATFORM_NAME: 'CADONCE',

  // Central Email Configuration (Founder's Email)
  FOUNDER_EMAIL: 'admin.cadonce@gmail.com',
  FOUNDER_EMAIL_PASSWORD: 'ssxa srxh qwjm xqen',
  FOUNDER_SENDER_NAME: 'CADONCE'
};

export const GLOBAL_CURRENCIES = [
  { label: 'US Dollar', code: 'USD', symbol: '$' },
  { label: 'Euro', code: 'EUR', symbol: '€' },
  { label: 'British Pound', code: 'GBP', symbol: '£' },
  { label: 'Indian Rupee', code: 'INR', symbol: '₹' },
  { label: 'Australian Dollar', code: 'AUD', symbol: 'A$' },
  { label: 'Canadian Dollar', code: 'CAD', symbol: 'C$' },
  { label: 'Singapore Dollar', code: 'SGD', symbol: 'S$' },
  { label: 'UAE Dirham', code: 'AED', symbol: 'د.إ' },
  { label: 'Saudi Riyal', code: 'SAR', symbol: '﷼' },
  { label: 'Japanese Yen', code: 'JPY', symbol: '¥' },
  { label: 'Chinese Yuan', code: 'CNY', symbol: '¥' },
  { label: 'Swiss Franc', code: 'CHF', symbol: 'CHF' },
  { label: 'South African Rand', code: 'ZAR', symbol: 'R' },
  { label: 'New Zealand Dollar', code: 'NZD', symbol: 'NZ$' },
  { label: 'Mexican Peso', code: 'MXN', symbol: '$' },
  { label: 'Brazilian Real', code: 'BRL', symbol: 'R$' },
  { label: 'Russian Ruble', code: 'RUB', symbol: '₽' },
  { label: 'Swedish Krona', code: 'SEK', symbol: 'kr' },
  { label: 'Norwegian Krone', code: 'NOK', symbol: 'kr' },
  { label: 'Turkish Lira', code: 'TRY', symbol: '₺' },
  { label: 'South Korean Won', code: 'KRW', symbol: '₩' },
  { label: 'Indonesian Rupiah', code: 'IDR', symbol: 'Rp' },
  { label: 'Malaysian Ringgit', code: 'MYR', symbol: 'RM' },
  { label: 'Philippine Peso', code: 'PHP', symbol: '₱' },
  { label: 'Thai Baht', code: 'THB', symbol: '฿' },
  { label: 'Vietnamese Dong', code: 'VND', symbol: '₫' }
];
