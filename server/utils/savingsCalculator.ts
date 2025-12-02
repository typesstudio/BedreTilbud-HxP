/**
 * Step 3.2: Null-safe savings calculator
 * 
 * Provides robust savings calculations that never produce NaN, Infinity, or unexpected results.
 * All calculations return explicit null when data is missing or invalid.
 * 
 * @module savingsCalculator
 */

export interface SavingsResult {
  hasPrice: boolean;
  savingsAmount: number | null;
  savingsPercentage: number | null;
  monthlySavings: number | null;
  currentPremium: number | null;
  offerPremium: number | null;
}

export interface TenYearProjection {
  hasPrice: boolean;
  totalOver10Years: number | null;
  after12Months: number | null;
  monthlyRange: {
    min: number | null;
    max: number | null;
  };
  chartData: Array<{ month: string; savings: number }>;
}

/**
 * Parses a premium string/number to a valid number or null.
 * Handles Danish number formats (e.g., "12.345,67") and common edge cases.
 * 
 * @param raw - Raw premium value (string, number, null, undefined)
 * @returns Parsed number or null if parsing fails
 */
export function parsePremiumToNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw;
  }
  
  if (typeof raw !== 'string') return null;
  
  let cleaned = raw.trim();
  if (!cleaned) return null;
  
  cleaned = cleaned
    .replace(/\s/g, '')
    .replace(/kr\.?/gi, '')
    .replace(/dkk/gi, '')
    .replace(/,-$/g, '')
    .trim();
  
  if (!cleaned) return null;
  
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    const afterComma = cleaned.split(',')[1] || '';
    if (afterComma.length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  const parsed = parseFloat(cleaned);
  
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  
  return parsed;
}

/**
 * Computes savings between current and offer premiums.
 * Returns explicit null values when either premium is missing or invalid.
 * 
 * CRITICAL: Never produces NaN or Infinity.
 * 
 * @param currentPremium - Current policy annual premium (number or null)
 * @param offerPremium - Offer policy annual premium (number or null)
 * @returns SavingsResult with hasPrice flag and null-safe values
 */
export function computeSavings(
  currentPremium: number | null | undefined,
  offerPremium: number | null | undefined
): SavingsResult {
  const validCurrent = typeof currentPremium === 'number' && Number.isFinite(currentPremium) && currentPremium > 0
    ? currentPremium
    : null;
  
  const validOffer = typeof offerPremium === 'number' && Number.isFinite(offerPremium) && offerPremium >= 0
    ? offerPremium
    : null;
  
  if (validCurrent == null || validOffer == null) {
    return {
      hasPrice: false,
      savingsAmount: null,
      savingsPercentage: null,
      monthlySavings: null,
      currentPremium: validCurrent,
      offerPremium: validOffer
    };
  }
  
  const savingsAmount = validCurrent - validOffer;
  const savingsPercentage = validCurrent > 0 
    ? Math.round((savingsAmount / validCurrent) * 1000) / 10
    : null;
  const monthlySavings = Math.round((savingsAmount / 12) * 100) / 100;
  
  return {
    hasPrice: true,
    savingsAmount,
    savingsPercentage,
    monthlySavings,
    currentPremium: validCurrent,
    offerPremium: validOffer
  };
}

/**
 * Generates 10-year savings projection with 120 monthly data points.
 * Returns empty chartData and null values when premium is missing.
 * 
 * @param annualSavings - Annual savings amount (number or null)
 * @param options - Optional multipliers for conservative/optimistic scenarios
 * @returns TenYearProjection with hasPrice flag and null-safe values
 */
export function compute10YearProjection(
  annualSavings: number | null | undefined,
  options: {
    conservativeMultiplier?: number;
    optimisticMultiplier?: number;
  } = {}
): TenYearProjection {
  const { 
    conservativeMultiplier = 0.8, 
    optimisticMultiplier = 1.2 
  } = options;
  
  if (annualSavings == null || !Number.isFinite(annualSavings)) {
    return {
      hasPrice: false,
      totalOver10Years: null,
      after12Months: null,
      monthlyRange: {
        min: null,
        max: null
      },
      chartData: []
    };
  }
  
  const monthlySavings = annualSavings / 12;
  const chartData: Array<{ month: string; savings: number }> = [];
  
  for (let i = 1; i <= 120; i++) {
    const year = Math.floor((i - 1) / 12) + 1;
    const month = ((i - 1) % 12) + 1;
    chartData.push({
      month: `År ${year}, Måned ${month}`,
      savings: Math.round(monthlySavings * i)
    });
  }
  
  return {
    hasPrice: true,
    totalOver10Years: Math.round(annualSavings * 10),
    after12Months: Math.round(annualSavings),
    monthlyRange: {
      min: Math.round((annualSavings * conservativeMultiplier) / 12),
      max: Math.round((annualSavings * optimisticMultiplier) / 12)
    },
    chartData
  };
}

/**
 * Safely formats a currency value for display.
 * Returns fallback string when value is null/undefined/NaN.
 * 
 * @param value - Numeric value to format
 * @param fallback - String to return when value is invalid (default: "Pris ukendt")
 * @returns Formatted currency string or fallback
 */
export function formatCurrencySafe(
  value: number | null | undefined,
  fallback: string = "Pris ukendt"
): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Safely formats a percentage value for display.
 * Returns fallback string when value is null/undefined/NaN.
 * 
 * @param value - Percentage value (e.g., 15.5 for 15.5%)
 * @param fallback - String to return when value is invalid (default: "")
 * @returns Formatted percentage string or fallback
 */
export function formatPercentageSafe(
  value: number | null | undefined,
  fallback: string = ""
): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  
  return `${value > 0 ? '-' : '+'}${Math.abs(value).toFixed(1)}%`;
}
