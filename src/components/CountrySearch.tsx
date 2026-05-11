"use client";
import React, { useState, useEffect, useRef } from 'react';

const countries = [
  { name: "Afghanistan", code: "AF", emoji: "🇦🇫" },
  { name: "Albania", code: "AL", emoji: "🇦🇱" },
  { name: "Algeria", code: "DZ", emoji: "🇩🇿" },
  { name: "Andorra", code: "AD", emoji: "🇦🇩" },
  { name: "Angola", code: "AO", emoji: "🇦🇴" },
  { name: "Antigua and Barbuda", code: "AG", emoji: "🇦🇬" },
  { name: "Argentina", code: "AR", emoji: "🇦🇷" },
  { name: "Armenia", code: "AM", emoji: "🇦🇲" },
  { name: "Australia", code: "AU", emoji: "🇦🇺" },
  { name: "Austria", code: "AT", emoji: "🇦🇹" },
  { name: "Azerbaijan", code: "AZ", emoji: "🇦🇿" },
  { name: "Bahamas", code: "BS", emoji: "🇧🇸" },
  { name: "Bahrain", code: "BH", emoji: "🇧🇭" },
  { name: "Bangladesh", code: "BD", emoji: "🇧🇩" },
  { name: "Barbados", code: "BB", emoji: "🇧🇧" },
  { name: "Belarus", code: "BY", emoji: "🇧🇾" },
  { name: "Belgium", code: "BE", emoji: "🇧🇪" },
  { name: "Belize", code: "BZ", emoji: "🇧🇿" },
  { name: "Benin", code: "BJ", emoji: "🇧🇯" },
  { name: "Bhutan", code: "BT", emoji: "🇧🇹" },
  { name: "Bolivia", code: "BO", emoji: "🇧🇴" },
  { name: "Bosnia and Herzegovina", code: "BA", emoji: "🇧🇦" },
  { name: "Botswana", code: "BW", emoji: "🇧🇼" },
  { name: "Brazil", code: "BR", emoji: "🇧🇷" },
  { name: "Brunei", code: "BN", emoji: "🇧🇳" },
  { name: "Bulgaria", code: "BG", emoji: "🇧🇬" },
  { name: "Burkina Faso", code: "BF", emoji: "🇧🇫" },
  { name: "Burundi", code: "BI", emoji: "🇧🇮" },
  { name: "Cabo Verde", code: "CV", emoji: "🇨🇻" },
  { name: "Cambodia", code: "KH", emoji: "🇰🇭" },
  { name: "Cameroon", code: "CM", emoji: "🇨🇲" },
  { name: "Canada", code: "CA", emoji: "🇨🇦" },
  { name: "Central African Republic", code: "CF", emoji: "🇨🇫" },
  { name: "Chad", code: "TD", emoji: "🇹🇩" },
  { name: "Chile", code: "CL", emoji: "🇨🇱" },
  { name: "China", code: "CN", emoji: "🇨🇳" },
  { name: "Colombia", code: "CO", emoji: "🇨🇴" },
  { name: "Comoros", code: "KM", emoji: "🇰🇲" },
  { name: "Congo (Congo-Brazzaville)", code: "CG", emoji: "🇨🇬" },
  { name: "Congo (Democratic Republic)", code: "CD", emoji: "🇨🇩" },
  { name: "Costa Rica", code: "CR", emoji: "🇨🇷" },
  { name: "Croatia", code: "HR", emoji: "🇭🇷" },
  { name: "Cuba", code: "CU", emoji: "🇨🇺" },
  { name: "Cyprus", code: "CY", emoji: "🇨🇾" },
  { name: "Czechia (Czech Republic)", code: "CZ", emoji: "🇨🇿" },
  { name: "Denmark", code: "DK", emoji: "🇩🇰" },
  { name: "Djibouti", code: "DJ", emoji: "🇩🇯" },
  { name: "Dominica", code: "DM", emoji: "🇩🇲" },
  { name: "Dominican Republic", code: "DO", emoji: "🇩🇴" },
  { name: "Ecuador", code: "EC", emoji: "🇪🇨" },
  { name: "Egypt", code: "EG", emoji: "🇪🇬" },
  { name: "El Salvador", code: "SV", emoji: "🇸🇻" },
  { name: "Equatorial Guinea", code: "GQ", emoji: "🇬🇶" },
  { name: "Eritrea", code: "ER", emoji: "🇪🇷" },
  { name: "Estonia", code: "EE", emoji: "🇪🇪" },
  { name: "Eswatini", code: "SZ", emoji: "🇸🇿" },
  { name: "Ethiopia", code: "ET", emoji: "🇪🇹" },
  { name: "Fiji", code: "FJ", emoji: "🇫🇯" },
  { name: "Finland", code: "FI", emoji: "🇫🇮" },
  { name: "France", code: "FR", emoji: "🇫🇷" },
  { name: "Gabon", code: "GA", emoji: "🇬🇦" },
  { name: "Gambia", code: "GM", emoji: "🇬🇲" },
  { name: "Georgia", code: "GE", emoji: "🇬🇪" },
  { name: "Germany", code: "DE", emoji: "🇩🇪" },
  { name: "Ghana", code: "GH", emoji: "🇬🇭" },
  { name: "Greece", code: "GR", emoji: "🇬🇷" },
  { name: "Grenada", code: "GD", emoji: "🇬🇩" },
  { name: "Guatemala", code: "GT", emoji: "🇬🇹" },
  { name: "Guinea", code: "GN", emoji: "🇬🇳" },
  { name: "Guinea-Bissau", code: "GW", emoji: "🇬🇼" },
  { name: "Guyana", code: "GY", emoji: "🇬🇾" },
  { name: "Haiti", code: "HT", emoji: "🇭🇹" },
  { name: "Holy See", code: "VA", emoji: "🇻🇦" },
  { name: "Honduras", code: "HN", emoji: "🇭🇳" },
  { name: "Hungary", code: "HU", emoji: "🇭🇺" },
  { name: "Iceland", code: "IS", emoji: "🇮🇸" },
  { name: "India", code: "IN", emoji: "🇮🇳" },
  { name: "Indonesia", code: "ID", emoji: "🇮🇩" },
  { name: "Iran", code: "IR", emoji: "🇮🇷" },
  { name: "Iraq", code: "IQ", emoji: "🇮🇶" },
  { name: "Ireland", code: "IE", emoji: "🇮🇪" },
  { name: "Israel", code: "IL", emoji: "🇮🇱" },
  { name: "Italy", code: "IT", emoji: "🇮🇹" },
  { name: "Jamaica", code: "JM", emoji: "🇯🇲" },
  { name: "Japan", code: "JP", emoji: "🇯🇵" },
  { name: "Jordan", code: "JO", emoji: "🇯🇴" },
  { name: "Kazakhstan", code: "KZ", emoji: "🇰🇿" },
  { name: "Kenya", code: "KE", emoji: "🇰🇪" },
  { name: "Kiribati", code: "KI", emoji: "🇰🇮" },
  { name: "Kuwait", code: "KW", emoji: "🇰🇼" },
  { name: "Kyrgyzstan", code: "KG", emoji: "🇰🇬" },
  { name: "Laos", code: "LA", emoji: "🇱🇦" },
  { name: "Latvia", code: "LV", emoji: "🇱🇻" },
  { name: "Lebanon", code: "LB", emoji: "🇱🇧" },
  { name: "Lesotho", code: "LS", emoji: "🇱🇸" },
  { name: "Liberia", code: "LR", emoji: "🇱🇷" },
  { name: "Libya", code: "LY", emoji: "🇱🇾" },
  { name: "Liechtenstein", code: "LI", emoji: "🇱🇮" },
  { name: "Lithuania", code: "LT", emoji: "🇱🇹" },
  { name: "Luxembourg", code: "LU", emoji: "🇱🇺" },
  { name: "Madagascar", code: "MG", emoji: "🇲🇬" },
  { name: "Malawi", code: "MW", emoji: "🇲🇼" },
  { name: "Malaysia", code: "MY", emoji: "🇲🇾" },
  { name: "Maldives", code: "MV", emoji: "🇲🇻" },
  { name: "Mali", code: "ML", emoji: "🇲🇱" },
  { name: "Malta", code: "MT", emoji: "🇲🇹" },
  { name: "Marshall Islands", code: "MH", emoji: "🇲🇭" },
  { name: "Mauritania", code: "MR", emoji: "🇲🇷" },
  { name: "Mauritius", code: "MU", emoji: "🇲🇺" },
  { name: "Mexico", code: "MX", emoji: "🇲🇽" },
  { name: "Micronesia", code: "FM", emoji: "🇫🇲" },
  { name: "Moldova", code: "MD", emoji: "🇲🇩" },
  { name: "Monaco", code: "MC", emoji: "🇲🇨" },
  { name: "Mongolia", code: "MN", emoji: "🇲🇳" },
  { name: "Montenegro", code: "ME", emoji: "🇲🇪" },
  { name: "Morocco", code: "MA", emoji: "🇲🇦" },
  { name: "Mozambique", code: "MZ", emoji: "🇲🇿" },
  { name: "Myanmar (Burma)", code: "MM", emoji: "🇲🇲" },
  { name: "Namibia", code: "NA", emoji: "🇳🇦" },
  { name: "Nauru", code: "NR", emoji: "🇳🇷" },
  { name: "Nepal", code: "NP", emoji: "🇳🇵" },
  { name: "Netherlands", code: "NL", emoji: "🇳🇱" },
  { name: "New Zealand", code: "NZ", emoji: "🇳🇿" },
  { name: "Nicaragua", code: "NI", emoji: "🇳🇮" },
  { name: "Niger", code: "NE", emoji: "🇳🇪" },
  { name: "Nigeria", code: "NG", emoji: "🇳🇬" },
  { name: "North Korea", code: "KP", emoji: "🇰🇵" },
  { name: "North Macedonia", code: "MK", emoji: "🇲🇰" },
  { name: "Norway", code: "NO", emoji: "🇳🇴" },
  { name: "Oman", code: "OM", emoji: "🇴🇲" },
  { name: "Pakistan", code: "PK", emoji: "🇵🇰" },
  { name: "Palau", code: "PW", emoji: "🇵🇼" },
  { name: "Palestine State", code: "PS", emoji: "🇵🇸" },
  { name: "Panama", code: "PA", emoji: "🇵🇦" },
  { name: "Papua New Guinea", code: "PG", emoji: "🇵🇬" },
  { name: "Paraguay", code: "PY", emoji: "🇵🇾" },
  { name: "Peru", code: "PE", emoji: "🇵🇪" },
  { name: "Philippines", code: "PH", emoji: "🇵🇭" },
  { name: "Poland", code: "PL", emoji: "🇵🇱" },
  { name: "Portugal", code: "PT", emoji: "🇵🇹" },
  { name: "Qatar", code: "QA", emoji: "🇶🇦" },
  { name: "Romania", code: "RO", emoji: "🇷🇴" },
  { name: "Russia", code: "RU", emoji: "🇷🇺" },
  { name: "Rwanda", code: "RW", emoji: "🇷🇼" },
  { name: "Saint Kitts and Nevis", code: "KN", emoji: "🇰🇳" },
  { name: "Saint Lucia", code: "LC", emoji: "🇱🇨" },
  { name: "Saint Vincent and the Grenadines", code: "VC", emoji: "🇻🇨" },
  { name: "Samoa", code: "WS", emoji: "🇼🇸" },
  { name: "San Marino", code: "SM", emoji: "🇸🇲" },
  { name: "Sao Tome and Principe", code: "ST", emoji: "🇸🇹" },
  { name: "Saudi Arabia", code: "SA", emoji: "🇸🇦" },
  { name: "Senegal", code: "SN", emoji: "🇸🇳" },
  { name: "Serbia", code: "RS", emoji: "🇷🇸" },
  { name: "Seychelles", code: "SC", emoji: "🇸🇨" },
  { name: "Sierra Leone", code: "SL", emoji: "🇸🇱" },
  { name: "Singapore", code: "SG", emoji: "🇸🇬" },
  { name: "Slovakia", code: "SK", emoji: "🇸🇰" },
  { name: "Slovenia", code: "SI", emoji: "🇸🇮" },
  { name: "Solomon Islands", code: "SB", emoji: "🇸🇧" },
  { name: "Somalia", code: "SO", emoji: "🇸🇴" },
  { name: "South Africa", code: "ZA", emoji: "🇿🇦" },
  { name: "South Korea", code: "KR", emoji: "🇰🇷" },
  { name: "South Sudan", code: "SS", emoji: "🇸🇸" },
  { name: "Spain", code: "ES", emoji: "🇪🇸" },
  { name: "Sri Lanka", code: "LK", emoji: "🇱🇰" },
  { name: "Sudan", code: "SD", emoji: "🇸🇩" },
  { name: "Suriname", code: "SR", emoji: "🇸🇷" },
  { name: "Sweden", code: "SE", emoji: "🇸🇪" },
  { name: "Switzerland", code: "CH", emoji: "🇨🇭" },
  { name: "Syria", code: "SY", emoji: "🇸🇾" },
  { name: "Taiwan", code: "TW", emoji: "🇹🇼" },
  { name: "Tajikistan", code: "TJ", emoji: "🇹🇯" },
  { name: "Tanzania", code: "TZ", emoji: "🇹🇿" },
  { name: "Thailand", code: "TH", emoji: "🇹🇭" },
  { name: "Timor-Leste", code: "TL", emoji: "🇹🇱" },
  { name: "Togo", code: "TG", emoji: "🇹🇬" },
  { name: "Tonga", code: "TO", emoji: "🇹🇴" },
  { name: "Trinidad and Tobago", code: "TT", emoji: "🇹🇹" },
  { name: "Tunisia", code: "TN", emoji: "🇹🇳" },
  { name: "Turkey", code: "TR", emoji: "🇹🇷" },
  { name: "Turkmenistan", code: "TM", emoji: "🇹🇲" },
  { name: "Tuvalu", code: "TV", emoji: "🇹🇻" },
  { name: "Uganda", code: "UG", emoji: "🇺🇬" },
  { name: "Ukraine", code: "UA", emoji: "🇺🇦" },
  { name: "United Arab Emirates", code: "AE", emoji: "🇦🇪" },
  { name: "United Kingdom", code: "GB", emoji: "🇬🇧" },
  { name: "United States of America", code: "US", emoji: "🇺🇸" },
  { name: "Uruguay", code: "UY", emoji: "🇺🇾" },
  { name: "Uzbekistan", code: "UZ", emoji: "🇺🇿" },
  { name: "Vanuatu", code: "VU", emoji: "🇻🇺" },
  { name: "Venezuela", code: "VE", emoji: "🇻🇪" },
  { name: "Vietnam", code: "VN", emoji: "🇻🇳" },
  { name: "Yemen", code: "YE", emoji: "🇾🇪" },
  { name: "Zambia", code: "ZM", emoji: "🇿🇲" },
  { name: "Zimbabwe", code: "ZW", emoji: "🇿🇼" }
];

interface CountrySearchProps {
  name: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

export function CountrySearch({ name, defaultValue = "", required = false, onChange }: CountrySearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(
    countries.find(c => c.name.toLowerCase() === defaultValue.toLowerCase() || c.code.toLowerCase() === defaultValue.toLowerCase()) || null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (defaultValue) {
      const country = countries.find(c => 
        c.name.toLowerCase() === defaultValue.toLowerCase() || 
        c.code.toLowerCase() === defaultValue.toLowerCase()
      );
      if (country) {
        setSelectedCountry(country);
      }
    }
  }, [defaultValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={selectedCountry?.name || ""} required={required} />
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-surface-container border border-white/10 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 rounded-2xl py-4 px-5 text-left flex items-center justify-between transition-all duration-300 text-white group shadow-sm"
      >
        <div className="flex items-center gap-3">
          {selectedCountry ? (
            <>
              <span className="text-lg">{selectedCountry.emoji}</span>
              <span className="font-medium">{selectedCountry.name}</span>
            </>
          ) : (
            <span className="text-neutral-500">Select Country...</span>
          )}
        </div>
        <span className="material-symbols-outlined text-neutral-500">expand_more</span>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-[#1a1710] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Search country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-xs text-neutral-500">search</span>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(country);
                    if (onChange) onChange(country.name);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className={`w-full text-left px-4 py-3 text-xs flex items-center gap-3 hover:bg-yellow-400 hover:text-black transition-all ${
                    selectedCountry?.code === country.code ? 'bg-yellow-400/10 text-yellow-400' : 'text-white/80'
                  }`}
                >
                  <span className="text-lg">{country.emoji}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="text-[10px] opacity-40 font-mono">{country.code}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-neutral-500 text-[10px] uppercase tracking-widest">
                No countries found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
