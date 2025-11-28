/**
 * TypeScript types for pre-computed health check and comparison JSON
 * 
 * These types define the shape of JSON stored in:
 * - policy_snapshots.health_check_json
 * - company_comparisons.comparison_json
 * 
 * These are populated by external flows (e.g., n8n, AI agents) and served
 * directly without re-computation on API requests.
 */

/**
 * Pre-computed health check result for a single policy snapshot.
 * Stored in policy_snapshots.health_check_json
 */
export type HealthCheckJson = {
  /** Overall health score (0-100) */
  score: number;
  
  /** Human-readable status label: "God", "Kan forbedres", "Anbefales" */
  statusLabel: string;
  
  /** Annual premium in DKK */
  annualPremium: number;
  
  /** Potential annual savings compared to benchmark (DKK) */
  potentialSavingsAnnual?: number;
  
  /** List of policy strengths (positive aspects) */
  strengths: {
    title: string;
    description?: string;
    variant?: 'success' | 'neutral';
  }[];
  
  /** List of policy weaknesses (areas for improvement) */
  weaknesses: {
    title: string;
    description?: string;
    severity?: 'warning' | 'error';
    variant?: 'warning' | 'error';
  }[];
  
  /** Coverage details with amounts and descriptions */
  coverages: {
    name: string;
    amount?: number | null;
    amountLabel?: string | null;
    description?: string | null;
    included?: boolean;
    deductible?: string | null;
  }[];
  
  /** Ten-year cumulative savings projection */
  tenYearSavings?: {
    year: number;
    cumulativeSavings: number;
  }[];
  
  /** Cumulative savings at different time horizons */
  cumulativeSavings?: {
    after12Months: number;
    after3Years: number;
    after5Years: number;
    after10Years: number;
  };
  
  /** Benchmark comparison data */
  benchmark?: {
    averagePremium: number;
    percentile: number;
    isAboveAverage: boolean;
  };
  
  /** Version of the health check algorithm used */
  version?: string;
  
  /** Timestamp when health check was computed */
  computedAt?: string;
  
  /** Allow additional fields without breaking type safety */
  [key: string]: unknown;
};

/**
 * Pre-computed comparison result between current and offer policies.
 * Stored in company_comparisons.comparison_json
 */
export type ComparisonJson = {
  /** Overall comparison summary */
  summary: {
    /** Current policy annual premium (DKK) */
    annualCurrent: number;
    /** Offer policy annual premium (DKK) */
    annualOffer: number;
    /** Annual savings amount (DKK) */
    annualSavings: number;
    /** Savings as percentage */
    savingsPercent: number;
  };
  
  /** Key highlights/differences to show the user */
  highlights: string[];
  
  /** Side-by-side coverage comparison */
  coverages: {
    name: string;
    current?: {
      included: boolean;
      amount?: number | null;
      amountLabel?: string | null;
      description?: string | null;
      deductible?: string | null;
    };
    offer?: {
      included: boolean;
      amount?: number | null;
      amountLabel?: string | null;
      description?: string | null;
      deductible?: string | null;
    };
    /** Comparison status: 'better', 'worse', 'equal', 'different' */
    status?: 'better' | 'worse' | 'equal' | 'different';
  }[];
  
  /** Ten-year projection of cumulative savings */
  tenYearProjection?: {
    year: number;
    cumulativeSavings: number;
  }[];
  
  /** Per-policy type breakdown */
  policyBreakdown?: {
    policyType: string;
    policyLabel: string;
    currentPremium: number;
    offerPremium: number;
    savings: number;
    recommendation?: 'switch' | 'keep' | 'review';
  }[];
  
  /** Pricing metadata */
  meta?: {
    pricingStatus: 'complete' | 'partial' | 'missing';
    computedAt?: string;
    version?: string;
  };
  
  /** Allow additional fields without breaking type safety */
  [key: string]: unknown;
};
