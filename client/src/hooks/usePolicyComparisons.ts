/**
 * usePolicyComparisons Hook
 * 
 * Fetches policy comparisons from the new simplified PolicyComparisonService.
 * Based on policy_snapshots architecture (Phase C).
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

export type PolicyComparisonRow = {
  policyType: string;
  coverageAddress: string | null;
  current: PolicySnapshotSummary | null;
  offers: PolicyOfferWithDelta[];
};

export type PolicyComparisonsResponse = {
  comparisons: PolicyComparisonRow[];
};

export function usePolicyComparisons() {
  return useQuery<PolicyComparisonsResponse>({
    queryKey: ["/api/policies/comparisons"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
