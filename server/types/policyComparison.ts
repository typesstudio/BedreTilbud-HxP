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
};
