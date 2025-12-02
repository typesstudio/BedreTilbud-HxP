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

/**
 * Step 4.4: Savings direction classification
 * - cheaper: Offer is cheaper than current (positive savings)
 * - same_price: Offer is roughly the same price (zero savings)
 * - more_expensive: Offer is more expensive (negative savings)
 * - null: Price data not available
 */
export type SavingsDirection = "cheaper" | "same_price" | "more_expensive" | null;

/**
 * Step 4.4: Per-policy savings calculation result
 */
export type PolicySavings = {
  hasPrice: boolean;
  savingsAmount: number | null;       // current - offer (positive = savings)
  savingsPercentage: number | null;   // savingsAmount / currentPremium
  monthlySavings: number | null;      // savingsAmount / 12
  direction: SavingsDirection;
};

/**
 * Step 4.4: Compute savings between current and offer premiums
 */
export function computeSavings(
  currentPremium: number | null,
  offerPremium: number | null
): PolicySavings {
  if (currentPremium == null || currentPremium <= 0) {
    return {
      hasPrice: false,
      savingsAmount: null,
      savingsPercentage: null,
      monthlySavings: null,
      direction: null,
    };
  }
  if (offerPremium == null || offerPremium < 0) {
    return {
      hasPrice: false,
      savingsAmount: null,
      savingsPercentage: null,
      monthlySavings: null,
      direction: null,
    };
  }

  const savingsAmount = currentPremium - offerPremium;
  const monthlySavings = savingsAmount / 12;
  const savingsPercentage = currentPremium > 0 ? savingsAmount / currentPremium : null;

  let direction: SavingsDirection = null;
  if (savingsAmount > 0) {
    direction = "cheaper";
  } else if (savingsAmount === 0) {
    direction = "same_price";
  } else if (savingsAmount < 0) {
    direction = "more_expensive";
  }

  return {
    hasPrice: true,
    savingsAmount,
    savingsPercentage,
    monthlySavings,
    direction,
  };
}

export type PolicyOfferWithDelta = PolicySnapshotSummary & {
  deltaAnnual: number | null;    // offer - current
  savingsAnnual: number | null;  // current - offer
  cheaperThanCurrent: boolean | null;
  savings: PolicySavings;        // Step 4.4: Full savings info with direction
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
 * Step 4.1/4.2/4.4: Extended response with partial coverage info and savings direction
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
    totalSavingsPercentage: number | null;
    totalMonthlySavings: number | null;
    totalCurrentPremium: number | null;
    totalOfferPremium: number | null;
    savingsDirection: SavingsDirection;
  };
};
