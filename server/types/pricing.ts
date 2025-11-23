/**
 * PolicyPricing Types
 * 
 * Used by PricingAgent to extract and normalize pricing information
 * from insurance policy documents.
 */

export type PolicyPricingStatus =
  | "ok"           // Clear, unambiguous pricing found
  | "unknown"      // No pricing information could be extracted
  | "conflict"     // Multiple conflicting prices found
  | "package_only"; // Only package prices (multiple policies) found

export interface RawPriceExpression {
  label: string;              // Short description or snippet from PDF
  amount: number;             // e.g. 8734.59 (in DKK)
  currency: "DKK";
  frequency:
    | "year"
    | "month"
    | "quarter"
    | "half_year"
    | "single"
    | "unknown";
  isPerPolicy: boolean | null;           // Is this price for this specific policy?
  isTotalForAllPolicies: boolean | null; // Or for a package of multiple policies?
}

export interface PolicyPricing {
  pricingStatus: PolicyPricingStatus;
  pricingConfidence: number;         // 0–1 (0 = no confidence, 1 = very confident)
  annualPremium: number | null;      // Always in DKK, converted if needed
  billingFrequency:
    | "year"
    | "month"
    | "quarter"
    | "half_year"
    | "single"
    | "mixed"
    | "unknown";
  rawPrices: RawPriceExpression[];   // All price expressions found in the text
  bindingMonths: number | null;      // Binding period in months (e.g., 12)
  hasIntroPrice: boolean;            // Whether an introductory price exists
  introPeriodMonths: number | null;  // Length of intro period in months
  introAnnualPremium: number | null; // Annualized intro price
  postBindingIncreasePercent: number | null; // Price increase after binding (%)
  notes: string;                     // Explanation of pricing extraction
  extractionVersion: string;         // e.g. "pricing_agent_v1"
}
