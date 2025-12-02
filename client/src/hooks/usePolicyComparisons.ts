/**
 * usePolicyComparisons Hook
 * 
 * Fetches policy comparisons from the new simplified PolicyComparisonService.
 * Based on policy_snapshots architecture (Phase C).
 * 
 * Step 4.1: Extended to include partial coverage info
 */

import { useQuery } from "@tanstack/react-query";

export type PricingComponent = {
  label: string;
  amount: number;
};

export type SnapshotPricing = {
  status: "exact" | "components_only" | "missing";
  annualPremium: number | null;
  currency: "DKK";
  confidence: number | null;
  components: PricingComponent[];
};

export type PolicySnapshotSummary = {
  snapshotId: string;
  documentId: string;
  kind: "current" | "offer";
  companyName: string;
  policyType: string;
  coverageAddress: string | null;
  pricing: SnapshotPricing | null;
};

/**
 * Step 4.1/4.2: Match status for policy comparison
 * - matched: Policy exists in both current and offer
 * - missing_in_offer: User has policy but offer doesn't include it
 * - missing_in_user: Offer has policy but user doesn't have it (extra policy)
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

export type PolicyOfferWithDelta = PolicySnapshotSummary & {
  deltaAnnual: number | null;
  savingsAnnual: number | null;
  cheaperThanCurrent: boolean | null;
  savings: PolicySavings;
};

export type PolicyComparisonRow = {
  policyType: string;
  coverageAddress: string | null;
  current: PolicySnapshotSummary | null;
  offers: PolicyOfferWithDelta[];
  matchStatus: PolicyMatchStatus;
};

export type MissingPolicyInfo = {
  policyType: string;
  label: string;
  currentPremium: number | null;
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

export type AggregatedSavings = {
  hasPrice: boolean;
  totalSavings: number | null;
  totalSavingsPercentage: number | null;
  totalMonthlySavings: number | null;
  totalCurrentPremium: number | null;
  totalOfferPremium: number | null;
  savingsDirection: SavingsDirection;
};

/**
 * Step 4.1/4.2: Extended response with partial coverage info
 */
export type PolicyComparisonsResponse = {
  comparisons: PolicyComparisonRow[];
  missingInOffers: MissingPolicyInfo[];
  extraOfferPolicies: ExtraOfferPolicy[];
  coversAllCurrentPolicies: boolean;
  matchedCount: number;
  totalCurrentCount: number;
  aggregatedSavings: AggregatedSavings;
};

export function usePolicyComparisons() {
  return useQuery<PolicyComparisonsResponse>({
    queryKey: ["/api/policies/comparisons"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
