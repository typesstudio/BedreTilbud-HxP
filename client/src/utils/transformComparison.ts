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
  cumulativeSavings: Array<{ label: string; value: number }>;
}

export interface ComparisonPolicyRowView {
  policyType: string;
  label: string;
  currentAnnual: number | null;
  offerAnnual: number | null;
  savingsAnnual: number | null;
  cheaperThanCurrent: boolean | null;
}

export interface ComparisonCoverageRowView {
  coverageLabel: string;
  coverageDescription: string | null;
  currentValue: string | null;
  offerValue: string | null;
  currentVariant: "success" | "error" | "neutral";
  offerVariant: "success" | "error" | "neutral";
  note: string | null;
}

export interface ComparisonHighlightView {
  icon: string;
  title: string;
  description: string;
  variant: "success" | "warning" | "neutral";
  category: string;
}

export interface ComparisonViewModel {
  id: string;
  offerCompanyName: string;
  currentCompanyName: string;
  overall: ComparisonOverallView;
  policies: ComparisonPolicyRowView[];
  coverageRows: ComparisonCoverageRowView[];
  highlights: ComparisonHighlightView[];
  recommendations: string[];
}

// ============================================================================
// TRANSFORMER FUNCTION
// ============================================================================

export function transformCompanyComparisonToViewModel(raw: any): ComparisonViewModel {
  const comparisonJson = raw.comparisonData || {};
  const overall = comparisonJson.overall || {};
  const policyComparisons = comparisonJson.policyComparisons || [];
  
  // Extract company names
  const currentCompanyName = raw.currentDocument?.ocrData?.companyName || "Din nuværende";
  const offerCompanyName = raw.offerDocument?.ocrData?.companyName || "Tilbud";

  // Transform overall view
  const overallView: ComparisonOverallView = {
    companyName: offerCompanyName,
    annualSavings: overall.annualSavings ?? 0,
    totalCurrentAnnual: overall.totalCurrentAnnualPremium ?? 0,
    totalOfferAnnual: overall.totalOfferAnnualPremium ?? 0,
    savingsPercent: overall.annualSavingsPercent ?? null,
    cumulativeSavings: transformCumulativeSavings(overall.cumulativeSavings),
  };

  // Transform policy rows
  const policies: ComparisonPolicyRowView[] = (overall.perPolicySummary || []).map((p: any) => ({
    policyType: p.policyType,
    label: p.label || capitalizeFirst(p.policyType),
    currentAnnual: p.currentAnnualPremium ?? null,
    offerAnnual: p.offerAnnualPremium ?? null,
    savingsAnnual: p.annualSavings ?? null,
    cheaperThanCurrent: p.annualSavings != null ? p.annualSavings > 0 : null,
  }));

  // Transform coverage rows from all policy comparisons
  const allCoverageRows: ComparisonCoverageRowView[] = [];
  const allHighlights: ComparisonHighlightView[] = [];
  const allRecommendations: string[] = [];

  policyComparisons.forEach((policy: any) => {
    // Extract coverage rows
    const coverageComparison = policy.coverageComparison || {};
    const rows = coverageComparison.rows || [];
    
    rows.forEach((row: any) => {
      allCoverageRows.push({
        coverageLabel: row.coverage || "Dækning",
        coverageDescription: row.description || null,
        currentValue: formatCoverageValue(row.current),
        offerValue: formatCoverageValue(row.offer),
        currentVariant: getVariantFromStatus(row.current?.status),
        offerVariant: getVariantFromStatus(row.offer?.status),
        note: row.note || null,
      });
    });

    // Extract highlights
    if (policy.highlights) {
      policy.highlights.forEach((h: any) => {
        allHighlights.push({
          icon: h.icon || "info",
          title: h.title || "",
          description: h.description || "",
          variant: h.variant || "neutral",
          category: h.category || "general",
        });
      });
    }

    // Extract recommendations
    if (policy.recommendations && Array.isArray(policy.recommendations)) {
      allRecommendations.push(...policy.recommendations);
    }
  });

  return {
    id: raw.id,
    offerCompanyName,
    currentCompanyName,
    overall: overallView,
    policies,
    coverageRows: allCoverageRows,
    highlights: allHighlights,
    recommendations: allRecommendations,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function transformCumulativeSavings(cumulativeSavings: any): Array<{ label: string; value: number }> {
  if (!cumulativeSavings || !cumulativeSavings.chartData) {
    return [];
  }

  const chartData = cumulativeSavings.chartData;
  if (!Array.isArray(chartData)) {
    return [];
  }

  return chartData.map((point: any, index: number) => ({
    label: point.label || `År ${index + 1}`,
    value: point.value || 0,
  }));
}

function formatCoverageValue(coverage: any): string | null {
  if (!coverage) return null;
  
  if (coverage.value === "inkluderet" || coverage.status === "included") {
    if (coverage.limit) {
      return coverage.limit;
    }
    return "inkluderet";
  }
  
  if (coverage.value === "ikke inkluderet" || coverage.status === "excluded") {
    return "ikke inkluderet";
  }

  if (coverage.limit) {
    return coverage.limit;
  }

  if (coverage.value) {
    return String(coverage.value);
  }

  return "-";
}

function getVariantFromStatus(coverage: any): "success" | "error" | "neutral" {
  if (!coverage) return "neutral";
  
  const status = coverage.status || "";
  
  if (status === "included" || coverage.value === "inkluderet") {
    return "success";
  }
  
  if (status === "excluded" || coverage.value === "ikke inkluderet") {
    return "error";
  }
  
  if (status === "error" || status === "worse") {
    return "error";
  }

  if (status === "warning" || status === "partial") {
    return "neutral";
  }

  return "neutral";
}

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
