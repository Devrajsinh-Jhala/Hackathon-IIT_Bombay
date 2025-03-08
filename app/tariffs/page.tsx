"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

// Type definitions
interface ProductDetails {
  description: string;
  hsCode: string;
  value: number;
  category: string;
}

interface TaxRate {
  standard: number;
  reduced?: number;
  importTariffFromIndia?: number;
  specialRates?: Record<string, number>;
  states?: Record<string, number>;
  provinces?: Record<string, number>;
}

interface TaxResult {
  importTariff: number;
  valueAddedTax: number;
  totalTaxRate: number;
  estimatedDuty: number;
  estimatedVAT: number;
  estimatedTotalCost: number;
  currency: string;
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
  exchangeRate: number; // Rate to INR
}

// Currency data with exchange rates to INR
const CURRENCIES: Record<string, Currency> = {
  US: { code: "USD", symbol: "$", name: "US Dollar", exchangeRate: 87.1 },
  UK: { code: "GBP", symbol: "£", name: "British Pound", exchangeRate: 112.49 },
  DE: { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 94.35 },
  FR: { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 94.35 },
  IT: { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 94.35 },
  CA: {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    exchangeRate: 60.57,
  },
  AU: {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    exchangeRate: 54.91,
  },
  JP: { code: "JPY", symbol: "¥", name: "Japanese Yen", exchangeRate: 0.59 }, // per 1 JPY
  CN: { code: "CNY", symbol: "¥", name: "Chinese Yuan", exchangeRate: 12.05 },
  AE: {
    code: "AED",
    symbol: " د . إ ",
    name: "UAE Dirham",
    exchangeRate: 23.72,
  },
  SG: {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    exchangeRate: 65.44,
  },
  KR: {
    code: "KRW",
    symbol: "₩",
    name: "South Korean Won",
    exchangeRate: 0.06,
  }, // per 1 KRW
  SA: { code: "SAR", symbol: "﷼", name: "Saudi Riyal", exchangeRate: 23.23 },
  BR: {
    code: "BRL",
    symbol: "R$",
    name: "Brazilian Real",
    exchangeRate: 15.05,
  },
  MX: { code: "MXN", symbol: "$", name: "Mexican Peso", exchangeRate: 4.3 },
  ZA: {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    exchangeRate: 4.78,
  },
  RU: { code: "RUB", symbol: "₽", name: "Russian Ruble", exchangeRate: 0.97 },
  ID: {
    code: "IDR",
    symbol: "Rp",
    name: "Indonesian Rupiah",
    exchangeRate: 0.005,
  }, // per 1 IDR
  TH: { code: "THB", symbol: "฿", name: "Thai Baht", exchangeRate: 2.59 },
  MY: {
    code: "MYR",
    symbol: "RM",
    name: "Malaysian Ringgit",
    exchangeRate: 19.74,
  },
  VN: {
    code: "VND",
    symbol: "₫",
    name: "Vietnamese Dong",
    exchangeRate: 0.0035,
  }, // per 1 VND
  PH: { code: "PHP", symbol: "₱", name: "Philippine Peso", exchangeRate: 1.52 },
  BD: {
    code: "BDT",
    symbol: "৳",
    name: "Bangladeshi Taka",
    exchangeRate: 0.79,
  },
  ES: { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 94.35 },
  CH: { code: "CHF", symbol: "Fr", name: "Swiss Franc", exchangeRate: 98.97 },
  NL: { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 94.35 },
  BE: { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 94.35 },
  SE: { code: "SEK", symbol: "kr", name: "Swedish Krona", exchangeRate: 8.63 },
  TR: { code: "TRY", symbol: "₺", name: "Turkish Lira", exchangeRate: 2.39 },
  PL: { code: "PLN", symbol: "zł", name: "Polish Złoty", exchangeRate: 22.63 },
  AT: { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 94.35 },
  IL: { code: "ILS", symbol: "₪", name: "Israeli Shekel", exchangeRate: 24.04 },
  DK: { code: "DKK", symbol: "kr", name: "Danish Krone", exchangeRate: 12.66 },
};

// Comprehensive tax rates for major importers of Indian products
const TAX_RATES: Record<string, TaxRate> = {
  US: {
    standard: 0.0,
    importTariffFromIndia: 0.1,
    specialRates: {
      textiles: 0.16,
      electronics: 0.06,
      pharmaceuticals: 0.02,
      jewelry: 0.08,
      automotive: 0.05,
      agricultural: 0.08,
      chemicals: 0.04,
    },
    states: {
      CA: 0.0725,
      NY: 0.04,
      TX: 0.0625,
      FL: 0.06,
      IL: 0.0625,
      PA: 0.06,
      OH: 0.0575,
      GA: 0.04,
      NC: 0.0475,
      MI: 0.06,
      NJ: 0.0625,
      VA: 0.043,
      WA: 0.065,
      MA: 0.0625,
      AZ: 0.056,
    },
  },
  UK: {
    standard: 0.2,
    importTariffFromIndia: 0.12,
    specialRates: {
      textiles: 0.12,
      electronics: 0.06,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  DE: {
    standard: 0.19,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.03,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  FR: {
    standard: 0.2,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  IT: {
    standard: 0.22,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  CA: {
    standard: 0.05,
    importTariffFromIndia: 0.08,
    specialRates: {
      textiles: 0.1,
      electronics: 0.05,
      pharmaceuticals: 0.02,
      jewelry: 0.06,
      automotive: 0.09,
      agricultural: 0.05,
      chemicals: 0.04,
    },
    provinces: {
      ON: 0.08,
      QC: 0.09975,
      BC: 0.07,
      AB: 0.0,
      MB: 0.07,
      SK: 0.06,
      NS: 0.1,
      NB: 0.1,
    },
  },
  AU: {
    standard: 0.1,
    importTariffFromIndia: 0.05,
    specialRates: {
      textiles: 0.1,
      electronics: 0.05,
      pharmaceuticals: 0.0,
      jewelry: 0.05,
      automotive: 0.05,
      agricultural: 0.0,
      chemicals: 0.05,
    },
  },
  JP: {
    standard: 0.1,
    importTariffFromIndia: 0.06,
    specialRates: {
      textiles: 0.08,
      electronics: 0.0,
      pharmaceuticals: 0.0,
      jewelry: 0.05,
      automotive: 0.0,
      agricultural: 0.12,
      chemicals: 0.04,
    },
  },
  CN: {
    standard: 0.13,
    importTariffFromIndia: 0.13,
    specialRates: {
      textiles: 0.1,
      electronics: 0.15,
      pharmaceuticals: 0.08,
      jewelry: 0.14,
      automotive: 0.15,
      agricultural: 0.12,
      chemicals: 0.1,
    },
  },
  AE: {
    standard: 0.05,
    importTariffFromIndia: 0.05,
    specialRates: {
      textiles: 0.05,
      electronics: 0.03,
      pharmaceuticals: 0.01,
      jewelry: 0.05,
      automotive: 0.05,
      agricultural: 0.02,
      chemicals: 0.04,
    },
  },
  SG: {
    standard: 0.08,
    importTariffFromIndia: 0.01,
    specialRates: {
      textiles: 0.0,
      electronics: 0.0,
      pharmaceuticals: 0.0,
      jewelry: 0.02,
      automotive: 0.0,
      agricultural: 0.0,
      chemicals: 0.0,
    },
  },
  KR: {
    standard: 0.1,
    importTariffFromIndia: 0.07,
    specialRates: {
      textiles: 0.1,
      electronics: 0.05,
      pharmaceuticals: 0.02,
      jewelry: 0.08,
      automotive: 0.08,
      agricultural: 0.15,
      chemicals: 0.06,
    },
  },
  SA: {
    standard: 0.15,
    importTariffFromIndia: 0.05,
    specialRates: {
      textiles: 0.08,
      electronics: 0.07,
      pharmaceuticals: 0.02,
      jewelry: 0.1,
      automotive: 0.12,
      agricultural: 0.06,
      chemicals: 0.08,
    },
  },
  BR: {
    standard: 0.17,
    importTariffFromIndia: 0.12,
    specialRates: {
      textiles: 0.14,
      electronics: 0.12,
      pharmaceuticals: 0.08,
      jewelry: 0.12,
      automotive: 0.15,
      agricultural: 0.1,
      chemicals: 0.1,
    },
  },
  MX: {
    standard: 0.16,
    importTariffFromIndia: 0.1,
    specialRates: {
      textiles: 0.15,
      electronics: 0.08,
      pharmaceuticals: 0.05,
      jewelry: 0.12,
      automotive: 0.1,
      agricultural: 0.12,
      chemicals: 0.08,
    },
  },
  ZA: {
    standard: 0.15,
    importTariffFromIndia: 0.1,
    specialRates: {
      textiles: 0.15,
      electronics: 0.08,
      pharmaceuticals: 0.02,
      jewelry: 0.1,
      automotive: 0.12,
      agricultural: 0.1,
      chemicals: 0.06,
    },
  },
  RU: {
    standard: 0.2,
    importTariffFromIndia: 0.1,
    specialRates: {
      textiles: 0.12,
      electronics: 0.1,
      pharmaceuticals: 0.05,
      jewelry: 0.15,
      automotive: 0.12,
      agricultural: 0.1,
      chemicals: 0.08,
    },
  },
  ID: {
    standard: 0.11,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.14,
      electronics: 0.08,
      pharmaceuticals: 0.05,
      jewelry: 0.1,
      automotive: 0.12,
      agricultural: 0.05,
      chemicals: 0.07,
    },
  },
  TH: {
    standard: 0.07,
    importTariffFromIndia: 0.08,
    specialRates: {
      textiles: 0.12,
      electronics: 0.07,
      pharmaceuticals: 0.04,
      jewelry: 0.1,
      automotive: 0.12,
      agricultural: 0.06,
      chemicals: 0.06,
    },
  },
  MY: {
    standard: 0.1,
    importTariffFromIndia: 0.06,
    specialRates: {
      textiles: 0.1,
      electronics: 0.05,
      pharmaceuticals: 0.03,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.05,
      chemicals: 0.05,
    },
  },
  VN: {
    standard: 0.1,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.08,
      pharmaceuticals: 0.05,
      jewelry: 0.1,
      automotive: 0.12,
      agricultural: 0.08,
      chemicals: 0.07,
    },
  },
  PH: {
    standard: 0.12,
    importTariffFromIndia: 0.08,
    specialRates: {
      textiles: 0.12,
      electronics: 0.07,
      pharmaceuticals: 0.03,
      jewelry: 0.1,
      automotive: 0.12,
      agricultural: 0.07,
      chemicals: 0.06,
    },
  },
  BD: {
    standard: 0.15,
    importTariffFromIndia: 0.07,
    specialRates: {
      textiles: 0.05,
      electronics: 0.1,
      pharmaceuticals: 0.05,
      jewelry: 0.1,
      automotive: 0.12,
      agricultural: 0.03,
      chemicals: 0.08,
    },
  },
  ES: {
    standard: 0.21,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  CH: {
    standard: 0.077,
    importTariffFromIndia: 0.05,
    specialRates: {
      textiles: 0.08,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.06,
      automotive: 0.08,
      agricultural: 0.06,
      chemicals: 0.04,
    },
  },
  NL: {
    standard: 0.21,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  BE: {
    standard: 0.21,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  SE: {
    standard: 0.25,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  TR: {
    standard: 0.18,
    importTariffFromIndia: 0.08,
    specialRates: {
      textiles: 0.14,
      electronics: 0.08,
      pharmaceuticals: 0.04,
      jewelry: 0.12,
      automotive: 0.1,
      agricultural: 0.08,
      chemicals: 0.06,
    },
  },
  PL: {
    standard: 0.23,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  AT: {
    standard: 0.2,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
  IL: {
    standard: 0.17,
    importTariffFromIndia: 0.07,
    specialRates: {
      textiles: 0.1,
      electronics: 0.08,
      pharmaceuticals: 0.0,
      jewelry: 0.12,
      automotive: 0.1,
      agricultural: 0.05,
      chemicals: 0.06,
    },
  },
  DK: {
    standard: 0.25,
    importTariffFromIndia: 0.09,
    specialRates: {
      textiles: 0.12,
      electronics: 0.04,
      pharmaceuticals: 0.0,
      jewelry: 0.08,
      automotive: 0.1,
      agricultural: 0.09,
      chemicals: 0.06,
    },
  },
};

// Country display names
const countryNames: Record<string, string> = {
  US: "United States",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  CA: "Canada",
  AU: "Australia",
  JP: "Japan",
  CN: "China",
  AE: "United Arab Emirates",
  SG: "Singapore",
  KR: "South Korea",
  SA: "Saudi Arabia",
  BR: "Brazil",
  MX: "Mexico",
  ZA: "South Africa",
  RU: "Russia",
  ID: "Indonesia",
  TH: "Thailand",
  MY: "Malaysia",
  VN: "Vietnam",
  PH: "Philippines",
  BD: "Bangladesh",
  ES: "Spain",
  CH: "Switzerland",
  NL: "Netherlands",
  BE: "Belgium",
  SE: "Sweden",
  TR: "Turkey",
  PL: "Poland",
  AT: "Austria",
  IL: "Israel",
  DK: "Denmark",
};

export default function IndiaExportTaxCalculator() {
  // Create client-only rendering mechanism
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Return server-side placeholder during SSR to avoid hydration errors
  if (!isClient) {
    return <TaxCalculatorSkeleton />;
  }

  // Render client-side component once hydration is complete
  return <TaxCalculatorClient />;
}

// Skeleton component for server-side rendering
function TaxCalculatorSkeleton() {
  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            India Export Tax & Tariff Calculator
          </h1>
          <p className="text-gray-600">
            Calculate import duties and taxes for products exported from India
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md h-[600px]">
            <h2 className="text-xl font-semibold mb-4">
              Export Product Information
            </h2>
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded w-full mt-6"></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md h-[600px]">
            <h2 className="text-xl font-semibold mb-4">Calculation Results</h2>
            <div className="text-center py-12">
              <div
                className="mx-auto opacity-30 h-16 w-16 flex items-center justify-center border-2 border
dashed rounded-full"
              >
                <span className="text-2xl">₹</span>
              </div>
              <div className="mt-4 text-gray-500">Loading calculator...</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Utility functions for currency formatting - only called on client
const formatCurrency = (
  value: number,
  currencyCode: string = "USD"
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`;
};

// Client-side only component with full functionality
function TaxCalculatorClient() {
  const [productDetails, setProductDetails] = useState<ProductDetails>({
    description: "",
    hsCode: "",
    value: 1000,
    category: "electronics",
  });

  const exportingCountry = "IN"; // Fixed as India
  const [importingCountry, setImportingCountry] = useState("US");
  const [importingState, setImportingState] = useState("");

  const [result, setResult] = useState<TaxResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);

  // Get currency data for selected country
  const selectedCurrency = CURRENCIES[importingCountry] || {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    exchangeRate: 87.1,
  };

  // Get available states/provinces based on selected country
  const usStates =
    importingCountry === "US" && TAX_RATES.US.states
      ? Object.keys(TAX_RATES.US.states)
      : [];

  const caProvinces =
    importingCountry === "CA" && TAX_RATES.CA.provinces
      ? Object.keys(TAX_RATES.CA.provinces)
      : [];

  // Product categories based on India's major exports
  const categories = [
    "electronics",
    "textiles",
    "pharmaceuticals",
    "jewelry",
    "automotive",
    "agricultural",
    "chemicals",
  ];

  // Sort countries alphabetically by their display names
  const sortedCountryCodes = Object.keys(TAX_RATES).sort((a, b) => {
    const nameA = countryNames[a] || a;
    const nameB = countryNames[b] || b;
    return nameA.localeCompare(nameB);
  });

  // Fetch exchange rate when country changes
  useEffect(() => {
    setIsLoadingExchangeRate(true);

    // Here we're using the stored exchange rate data
    // In a real app, you might want to fetch this from an API
    const currency = CURRENCIES[importingCountry];
    if (currency) {
      setExchangeRate(currency.exchangeRate);
    } else {
      setExchangeRate(null);
    }

    setIsLoadingExchangeRate(false);
  }, [importingCountry]);

  // Convert value to selected currency
  const convertToLocalCurrency = (valueUSD: number): number => {
    if (!selectedCurrency || selectedCurrency.code === "USD") return valueUSD;
    // Convert from USD to local currency using approximate rates
    return valueUSD / (selectedCurrency.exchangeRate / 87.1);
  };

  // Tax calculation function
  const calculateImportCosts = (
    productDetails: ProductDetails,
    exportingCountry: string,
    importingCountry: string,
    importingState?: string
  ): TaxResult => {
    const importingCountryRates = TAX_RATES[importingCountry];

    if (!importingCountryRates) {
      throw new Error(`Country ${importingCountry} not found in tax database`);
    }

    // Get tariff rate
    let importTariff = importingCountryRates.importTariffFromIndia ?? 0;
    const category = productDetails.category;

    if (
      category &&
      importingCountryRates.specialRates &&
      category in importingCountryRates.specialRates
    ) {
      importTariff = importingCountryRates.specialRates[category] || 0;
    }

    // Get VAT/sales tax
    let valueAddedTax = importingCountryRates.standard || 0;

    // Add state/province tax for US/Canada
    if (
      importingCountry === "US" &&
      importingState &&
      importingCountryRates.states &&
      importingState in importingCountryRates.states
    ) {
      valueAddedTax = importingCountryRates.states[importingState];
    } else if (
      importingCountry === "CA" &&
      importingState &&
      importingCountryRates.provinces &&
      importingState in importingCountryRates.provinces
    ) {
      valueAddedTax = importingCountryRates.provinces[importingState];
    }

    // Calculate totals
    const dutyAmount = productDetails.value * importTariff;
    const valueWithDuty = productDetails.value + dutyAmount;
    const vatAmount = valueWithDuty * valueAddedTax;
    const totalTaxRate =
      importTariff + valueAddedTax + importTariff * valueAddedTax;

    return {
      importTariff,
      valueAddedTax,
      totalTaxRate,
      estimatedDuty: dutyAmount,
      estimatedVAT: vatAmount,
      estimatedTotalCost: productDetails.value + dutyAmount + vatAmount,
      currency: "USD",
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const calculationResult = calculateImportCosts(
        productDetails,
        exportingCountry,
        importingCountry,
        importingState
      );

      setResult(calculationResult);
    } catch (error) {
      console.error("Calculation error:", error);
      alert(
        "Error calculating taxes: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          India Export Tax & Tariff Calculator
        </h1>
        <p className="text-gray-600">
          Calculate import duties and taxes for products exported from India to
          global markets
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">
            Export Product Information
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Description
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g. Cotton T-Shirts"
                value={productDetails.description}
                onChange={(e) =>
                  setProductDetails({
                    ...productDetails,
                    description: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HS Code
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g. 6109.10"
                value={productDetails.hsCode}
                onChange={(e) =>
                  setProductDetails({
                    ...productDetails,
                    hsCode: e.target.value,
                  })
                }
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                Enter the 6-10 digit Harmonized System code for your product
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Value (USD)
              </label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={productDetails.value}
                onChange={(e) =>
                  setProductDetails({
                    ...productDetails,
                    value: Number(e.target.value),
                  })
                }
                required
              />
              {selectedCurrency && selectedCurrency.code !== "USD" && (
                <div className="text-xs text-gray-600 mt-1">
                  Approx.{" "}
                  {formatCurrency(
                    convertToLocalCurrency(productDetails.value),
                    selectedCurrency.code
                  )}{" "}
                  in {selectedCurrency.name}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Category
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={productDetails.category}
                onChange={(e) =>
                  setProductDetails({
                    ...productDetails,
                    category: e.target.value,
                  })
                }
                required
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination Country
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={importingCountry}
                onChange={(e) => {
                  setImportingCountry(e.target.value);
                  setImportingState(""); // Reset state when country changes
                }}
                required
              >
                {sortedCountryCodes.map((country) => (
                  <option key={country} value={country}>
                    {countryNames[country] || country}
                  </option>
                ))}
              </select>

              {/* Currency Exchange Rate Display */}
              <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-100">
                {isLoadingExchangeRate ? (
                  <div className="text-sm text-gray-600">
                    Loading exchange rate...
                  </div>
                ) : selectedCurrency && exchangeRate ? (
                  <div className="text-sm">
                    <div className="font-medium text-blue-800">
                      Currency: {selectedCurrency.name}({selectedCurrency.code})
                    </div>
                    <div className="mt-1 text-gray-700">
                      <span className="font-medium">Exchange Rate:</span> 1{" "}
                      {selectedCurrency.code} = ₹{exchangeRate.toFixed(2)} INR
                    </div>
                    <div className="mt-1 text-gray-700">
                      <span className="font-medium">Inverse Rate:</span> ₹1 INR
                      = {(1 / exchangeRate).toFixed(5)} {selectedCurrency.code}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    Exchange rate data not available
                  </div>
                )}
              </div>
            </div>

            {importingCountry === "US" && usStates.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  US State
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={importingState}
                  onChange={(e) => setImportingState(e.target.value)}
                >
                  <option value="">Select state...</option>
                  {usStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {importingCountry === "CA" && caProvinces.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Canadian Province
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={importingState}
                  onChange={(e) => setImportingState(e.target.value)}
                >
                  <option value="">Select province...</option>
                  {caProvinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-6">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 
focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                {isLoading ? "Calculating..." : "Calculate Taxes & Tariffs"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0 text-orange-400 font-bold">i</div>
              <div className="ml-3">
                <div className="text-sm text-orange-700">
                  This calculator provides estimated import duties and taxes for
                  exports from India. Actual rates may vary based on specific HS
                  codes and trade agreements.
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">Calculation Results</h2>

          {result ? (
            <div>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-medium text-gray-800">
                  Export Information
                </h3>
                <div className="text-sm text-gray-600 mt-1">
                  <strong>From:</strong> India
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <strong>To:</strong>{" "}
                  {countryNames[importingCountry] || importingCountry}
                  {importingCountry === "US" && importingState
                    ? ` (${importingState})`
                    : ""}
                  {importingCountry === "CA" && importingState
                    ? ` (${importingState})`
                    : ""}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <strong>Product:</strong> {productDetails.description}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <strong>Category:</strong>{" "}
                  {productDetails.category.charAt(0).toUpperCase() +
                    productDetails.category.slice(1)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <strong>HS Code:</strong> {productDetails.hsCode}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <strong>Product Value:</strong>{" "}
                  {formatCurrency(productDetails.value, "USD")}
                  {selectedCurrency && selectedCurrency.code !== "USD" && (
                    <span className="ml-2 text-xs">
                      (
                      {formatCurrency(
                        convertToLocalCurrency(productDetails.value),
                        selectedCurrency.code
                      )}
                      {selectedCurrency.code})
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-700">Import Tariff</span>
                  <span className="font-medium">
                    {formatPercentage(result.importTariff)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-700">
                    Value Added Tax / Sales Tax
                  </span>
                  <span className="font-medium">
                    {formatPercentage(result.valueAddedTax)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-700">Estimated Duty Amount</span>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(result.estimatedDuty, "USD")}
                    </div>
                    {selectedCurrency && selectedCurrency.code !== "USD" && (
                      <div className="text-xs text-gray-600">
                        {formatCurrency(
                          convertToLocalCurrency(result.estimatedDuty),
                          selectedCurrency.code
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      ₹{(result.estimatedDuty * 87.1).toFixed(2)} INR
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-700">
                    Estimated VAT/Sales Tax Amount
                  </span>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(result.estimatedVAT, "USD")}
                    </div>
                    {selectedCurrency && selectedCurrency.code !== "USD" && (
                      <div className="text-xs text-gray-600">
                        {formatCurrency(
                          convertToLocalCurrency(result.estimatedVAT),
                          selectedCurrency.code
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      ₹{(result.estimatedVAT * 87.1).toFixed(2)} INR
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 text-lg font-bold">
                  <span>Total Landed Cost</span>
                  <div className="text-right">
                    <div>
                      {formatCurrency(result.estimatedTotalCost, "USD")}
                    </div>
                    {selectedCurrency && selectedCurrency.code !== "USD" && (
                      <div className="text-sm font-normal">
                        {formatCurrency(
                          convertToLocalCurrency(result.estimatedTotalCost),
                          selectedCurrency.code
                        )}
                      </div>
                    )}
                    <div className="text-sm font-normal">
                      ₹{(result.estimatedTotalCost * 87.1).toFixed(2)} INR
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div
                className="mx-auto opacity-30 h-16 w-16 flex items-center justify-center border-2 border
dashed rounded-full"
              >
                <span className="text-2xl">₹</span>
              </div>
              <div className="mt-4 text-gray-500">
                Enter product details and click "Calculate" to see import duty
                and tax estimates
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
