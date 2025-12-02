/**
 * Policy Comparison Types
 * 
 * Used by PolicyComparisonService to compare current vs offer policies
 * based on PolicySnapshots.
 */

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
  policyType: string;          // "fritidshus" | "indbo" | "ulykke" | ...
  coverageAddress: string | null;
  pricing: SnapshotPricing | null;
};

export type PolicyOfferWithDelta = PolicySnapshotSummary & {
  deltaAnnual: number | null;    // offer - current
  savingsAnnual: number | null;  // current - offer
  cheaperThanCurrent: boolean | null;
};

export type PolicyComparisonRow = {
  policyType: string;
  coverageAddress: string | null;
  current: PolicySnapshotSummary | null;
  offers: PolicyOfferWithDelta[];
  matchStatus: 'matched' | 'missing_in_offer' | 'current_only';
};

/**
 * Step 4.1: Extended response with partial coverage info
 */
export type PolicyComparisonsWithCoverage = {
  comparisons: PolicyComparisonRow[];
  missingInOffers: Array<{
    policyType: string;
    label: string;
    currentPremium: number | null;
  }>;
  coversAllCurrentPolicies: boolean;
  matchedCount: number;
  totalCurrentCount: number;
  aggregatedSavings: {
    hasPrice: boolean;
    totalSavings: number | null;
    totalCurrentPremium: number | null;
    totalOfferPremium: number | null;
  };
};
