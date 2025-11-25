// Pure TypeScript transformer - no React/JSX imports

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ComparisonOverallView {
  companyName: string;
  annualSavings: number;
  totalCurrentAnnual: number;
  totalOfferAnnual: number;
  savingsPercent: number | null;
}

export interface ComparisonPolicyRowView {
  policyType: string;
  label: string;
  currentAnnual: number | null;
  offerAnnual: number | null;
  savingsAnnual: number | null;
  cheaperThanCurrent: boolean | null;
}

export interface ComparisonViewModel {
  id: string;
  offerCompanyName: string;
  currentCompanyName: string;
  overall: ComparisonOverallView;
  policies: ComparisonPolicyRowView[];
}

// ============================================================================
// TRANSFORMER FUNCTION
// ============================================================================

export function transformCompanyComparisonToViewModel(raw: any): ComparisonViewModel {
  // Extract data from API response structure
  const comparisonData = raw.comparisonData || {};
  const overall = comparisonData.overall || {};
  const perPolicySummary = overall.perPolicySummary || [];
  
  // Extract company names from document data
  const currentCompanyName = raw.currentDocument?.ocrData?.companyName || "Din nuværende";
  const offerCompanyName = raw.offerDocument?.ocrData?.companyName || "Tilbud";

  // Transform overall view
  const overallView: ComparisonOverallView = {
    companyName: offerCompanyName,
    annualSavings: overall.annualSavings ?? 0,
    totalCurrentAnnual: overall.totalCurrentAnnualPremium ?? 0,
    totalOfferAnnual: overall.totalOfferAnnualPremium ?? 0,
    savingsPercent: overall.annualSavingsPercent ?? null,
  };

  // Transform policy rows
  const policies: ComparisonPolicyRowView[] = perPolicySummary.map((p: any) => {
    const currentAnnual = p.currentAnnualPremium ?? null;
    const offerAnnual = p.offerAnnualPremium ?? null;
    const savingsAnnual = p.annualSavings ?? null;
    
    return {
      policyType: p.policyType,
      label: p.label || capitalizeFirst(p.policyType),
      currentAnnual,
      offerAnnual,
      savingsAnnual,
      cheaperThanCurrent: 
        currentAnnual !== null && offerAnnual !== null 
          ? offerAnnual < currentAnnual 
          : null,
    };
  });

  return {
    id: raw.id,
    offerCompanyName,
    currentCompanyName,
    overall: overallView,
    policies,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Format currency for Danish locale
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "Afventer";
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + " kr";
}
