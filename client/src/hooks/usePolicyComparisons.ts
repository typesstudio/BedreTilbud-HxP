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

export type PolicyOfferWithDelta = PolicySnapshotSummary & {
  deltaAnnual: number | null;
  savingsAnnual: number | null;
  cheaperThanCurrent: boolean | null;
};

export type PolicyMatchStatus = 'matched' | 'missing_in_offer' | 'current_only';

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

export type AggregatedSavings = {
  hasPrice: boolean;
  totalSavings: number | null;
  totalCurrentPremium: number | null;
  totalOfferPremium: number | null;
};

/**
 * Step 4.1: Extended response with partial coverage info
 */
export type PolicyComparisonsResponse = {
  comparisons: PolicyComparisonRow[];
  missingInOffers: MissingPolicyInfo[];
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
