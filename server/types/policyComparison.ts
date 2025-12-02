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

/**
 * Step 4.1/4.2: Match status for policy comparison
 * - matched: Policy exists in both current and offer
 * - missing_in_offer: User has policy but offer doesn't include it (current_only)
 * - missing_in_user: Offer has policy but user doesn't have it (extra policy in offer)
 */
export type PolicyMatchStatus = 'matched' | 'missing_in_offer' | 'missing_in_user';

export type PolicyComparisonRow = {
  policyType: string;
  coverageAddress: string | null;
  current: PolicySnapshotSummary | null;
  offers: PolicyOfferWithDelta[];
  matchStatus: PolicyMatchStatus;
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
 * Step 4.1/4.2: Extended response with partial coverage info
 */
export type PolicyComparisonsWithCoverage = {
  comparisons: PolicyComparisonRow[];
  missingInOffers: Array<{
    policyType: string;
    label: string;
    currentPremium: number | null;
  }>;
  extraOfferPolicies: ExtraOfferPolicy[];
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
