/**
 * API Response DTOs for Ticket B - Read-only endpoints
 * 
 * These types define the shape of responses for health check and comparison endpoints
 * that read from pre-computed JSON columns (healthCheckJson, comparisonJSON).
 * 
 * NO AI or heavy computation happens when serving these endpoints.
 */

import type { HealthCheckJson, ComparisonJson } from "./types/healthCheck";

/**
 * Single policy summary for the health check overview
 */
export type HealthCheckOverviewPolicyDto = {
  id: string;
  policyType: string;           // e.g., "indbo", "hus", "ulykke"
  policyLabel: string;          // Danish label: "Indboforsikring", "Husforsikring"
  companyName: string | null;
  kind: string;                 // "current" or "offer"
  annualPremium: number | null;
  healthScore: number | null;
  potentialSavingsAnnual: number | null;
  statusLabel: string | null;   // "God", "Kan forbedres", "Kritisk", etc.
  hasHealthCheck: boolean;      // Whether healthCheckJson is populated
};

/**
 * Response for GET /api/v2/health-check/user/:userId/overview
 * Returns all policy summaries for a user from pre-computed healthCheckJson
 */
export type HealthCheckOverviewResponse = {
  userId: string;
  totalPolicies: number;
  policiesWithHealthCheck: number;
  policies: HealthCheckOverviewPolicyDto[];
};

/**
 * Response for GET /api/v2/health-check/policy/:policyId
 * Returns the full pre-computed healthCheckJson for a single policy
 */
export type HealthCheckDetailResponse = HealthCheckJson & {
  policyId: string;
  policyType: string;
  companyName: string;
};

/**
 * Single policy pair summary for comparison overview
 */
export type ComparisonPolicyDto = {
  policyType: string;
  policyLabel: string;
  currentPremium: number | null;
  offerPremium: number | null;
  annualSavings: number | null;
  savingsPercent: number | null;
  recommendation?: 'switch' | 'keep' | 'review';
};

/**
 * Response for GET /api/v2/comparisons/:comparisonId/overview
 * Returns aggregated comparison summary from pre-computed comparisonJSON
 */
export type ComparisonOverviewResponse = {
  comparisonId: string;
  currentCompany: string;
  offerCompany: string;
  status: string;
  totalAnnualCurrent: number | null;
  totalAnnualOffer: number | null;
  totalAnnualSavings: number | null;
  savingsPercent: number | null;
  pricingStatus: 'complete' | 'partial' | 'missing' | null;
  policies: ComparisonPolicyDto[];
  highlights: string[];
  hasComparison: boolean;       // Whether comparisonJSON is populated
};

/**
 * Response for GET /api/v2/comparisons/:comparisonId/detail
 * Returns the full pre-computed comparisonJSON
 */
export type ComparisonDetailResponse = ComparisonJson & {
  comparisonId: string;
  currentCompany: string;
  offerCompany: string;
};

/**
 * Policy type labels mapping (Danish)
 */
export const POLICY_TYPE_LABELS: Record<string, string> = {
  indbo: 'Indboforsikring',
  hus: 'Husforsikring',
  fritidshus: 'Fritidshusforsikring',
  ulykke: 'Ulykkesforsikring',
  bil: 'Bilforsikring',
  rejse: 'Rejseforsikring',
  husdyr: 'Husdyrforsikring',
  baad: 'Bådforsikring',
  other: 'Anden forsikring',
};

/**
 * Get Danish label for a policy type
 */
export function getPolicyTypeLabel(policyType: string): string {
  return POLICY_TYPE_LABELS[policyType.toLowerCase()] || policyType;
}

/**
 * Step 4.1: Policy match status for partial coverage detection
 */
export type PolicyMatchStatus = 'matched' | 'missing_in_offer' | 'missing_in_user';

/**
 * Step 4.4: Savings direction classification
 * - cheaper: Offer is cheaper than current (positive savings)
 * - same_price: Offer is roughly the same price (zero savings)
 * - more_expensive: Offer is more expensive (negative savings)
 * - null: Price data not available
 */
export type SavingsDirection = "cheaper" | "same_price" | "more_expensive" | null;

/**
 * Step 4.4: Per-policy savings with direction
 */
export type PolicySavings = {
  hasPrice: boolean;
  savingsAmount: number | null;
  savingsPercentage: number | null;
  monthlySavings: number | null;
  direction: SavingsDirection;
};

/**
 * Step 4.1: Policy match row with status
 * Used to track which policies are matched vs missing in comparisons
 */
export type PolicyMatchRow = {
  policyType: string;
  label: string;
  matchStatus: PolicyMatchStatus;
  currentPolicyId: string | null;
  offerPolicyId: string | null;
  currentPremium: number | null;
  offerPremium: number | null;
  hasPrice: boolean;
};

/**
 * Step 4.1: Missing policy info for UI display
 */
export type MissingPolicyInfo = {
  policyType: string;
  label: string;
};

/**
 * Step 4.2: Extra policy in offer that user doesn't have
 */
export type ExtraOfferPolicy = {
  policyType: string;
  label: string;
  offerPolicyId: string;
  companyName: string;
  premiumAmount: number | null;
};

/**
 * Step 4.1/4.2/4.4: Extended combined overview with partial coverage info and savings direction
 */
export type CombinedOverviewWithCoverage = {
  totalSavings: number | null;
  totalSavingsPercentage: number | null;
  totalMonthlySavings: number | null;
  hasPrice: boolean;
  savingsDirection: SavingsDirection;
  policyCount: number;
  matchedPolicyCount: number;
  verdict: 'recommended' | 'consider' | 'not_recommended';
  highlights: Array<{
    title: string;
    description: string;
    icon: string;
    variant: 'success' | 'warning' | 'error';
  }>;
  quickComparison: Array<{
    policyType: string;
    label: string;
    currentPremium: number | null;
    offerPremium: number | null;
    savings: number | null;
    hasPrice: boolean;
    verdict: string;
    matchStatus: PolicyMatchStatus;
    savingsDirection: SavingsDirection;
  }>;
  comparisonIds: string[];
  policyMatches: PolicyMatchRow[];
  missingPolicyTypes: MissingPolicyInfo[];
  extraOfferPolicies: ExtraOfferPolicy[];
  coversAllCurrentPolicies: boolean;
};
