/**
 * PolicyPricing Types
 * 
 * Used by PricingAgent to extract and normalize pricing information
 * from insurance policy documents.
 */

import { z } from "zod";

export type PolicyPricingStatus =
  | "ok"           // Clear, unambiguous pricing found
  | "unknown"      // No pricing information could be extracted
  | "conflict"     // Multiple conflicting prices found
  | "package_only" // Only package prices (multiple policies) found
  | "missing"      // Pricing explicitly not found after all passes
  | "needs_manual_review"; // Pricing found but uncertain

// Multi-pass extraction source tracking
export type PricingSource =
  | "segment_regex"    // Pass 1: Found in segment via regex
  | "segment_llm"      // Pass 3: LLM extracted from segment
  | "nearby_ocr"       // Pass 2: Found in nearby OCR pages
  | "global_recovery"  // Pass 3: LLM searched full document
  | null;              // No pricing found

// Confidence levels for pricing extraction
export type PricingConfidenceLevel =
  | "high"     // Very confident (direct regex match)
  | "medium"   // Moderately confident (nearby OCR or LLM)
  | "low"      // Low confidence (global search or uncertain)
  | "missing"; // No pricing found

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
  pricingConfidence: number;         // 0–100 (0 = no confidence, 100 = very confident)
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
  // Multi-pass pipeline tracking (added Dec 2025)
  pricingSource: PricingSource;      // Which pass found the price
  confidenceLevel: PricingConfidenceLevel; // Structured confidence level
}

// ========================================
// Zod Schemas for Runtime Validation
// ========================================

const RawPriceExpressionSchema = z.object({
  label: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.literal("DKK"),
  frequency: z.enum(["year", "month", "quarter", "half_year", "single", "unknown"]),
  isPerPolicy: z.boolean().nullable(),
  isTotalForAllPolicies: z.boolean().nullable()
});

export const PolicyPricingSchema = z.object({
  pricingStatus: z.enum(["ok", "unknown", "conflict", "package_only", "missing", "needs_manual_review"]),
  pricingConfidence: z.number().min(0).max(100),
  annualPremium: z.number().positive().nullable(),
  billingFrequency: z.enum(["year", "month", "quarter", "half_year", "single", "mixed", "unknown"]),
  rawPrices: z.array(RawPriceExpressionSchema),
  bindingMonths: z.number().positive().nullable(),
  hasIntroPrice: z.boolean(),
  introPeriodMonths: z.number().positive().nullable(),
  introAnnualPremium: z.number().positive().nullable(),
  postBindingIncreasePercent: z.number().nullable(),
  notes: z.string(),
  extractionVersion: z.string(),
  // Multi-pass pipeline tracking (added Dec 2025)
  pricingSource: z.enum(["segment_regex", "segment_llm", "nearby_ocr", "global_recovery"]).nullable().optional(),
  confidenceLevel: z.enum(["high", "medium", "low", "missing"]).optional()
});
