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
  cumulativeSavings?: { label: string; value: number }[];
}

export interface ComparisonPolicyRowView {
  policyType: string;
  label: string;
  currentAnnual: number | null;
  offerAnnual: number | null;
  savingsAnnual: number | null;
  cheaperThanCurrent: boolean | null;
}

export interface ComparisonHighlightView {
  id: string;
  title: string;
  description: string | null;
  kind: "coverage_up" | "deductible_down" | "service_extra" | "tech_extra" | "generic";
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

export interface SavingsSeriesView {
  key: string;          // "indbo", "hus", "ulykke"
  label: string;        // "Indbo", "Hus", "Ulykke"
  annualSavings: number;
  monthlySavings: number;
  tenYearSavings: number;
  points: { month: number; cumulative: number }[];
}

export interface SavingsOverTimeView {
  totalAnnualSavings: number;
  totalTenYearSavings: number;
  series: SavingsSeriesView[];
}

export type ComparisonTabKey = "samlet" | "indbo" | "hus" | "ulykke" | "bil" | "rejse";

export interface ComparisonTabView {
  key: ComparisonTabKey;
  label: string;
  policyType: string | null;
  isAvailable: boolean;
  
  // Snapshot IDs for navigation to health check
  offerSnapshotId?: string | null;
  currentSnapshotId?: string | null;
  
  summary: {
    annualSavings: number;
    totalCurrentAnnual: number;
    totalOfferAnnual: number;
    savingsPercent: number;
  };
  
  quickRows: ComparisonPolicyRowView[];
  highlights: ComparisonHighlightView[];
  coverageRows: ComparisonCoverageRowView[];
  savingsOverTime: SavingsOverTimeView | null;
}

export interface ComparisonViewModel {
  id: string;
  offerCompanyName: string;
  currentCompanyName: string;
  overall: ComparisonOverallView;
  policies: ComparisonPolicyRowView[];
  highlights: ComparisonHighlightView[];
  coverageRows: ComparisonCoverageRowView[];
  savingsOverTime: SavingsOverTimeView | null;
  
  tabs: Record<ComparisonTabKey, ComparisonTabView>;
  defaultTab: ComparisonTabKey;
}

// ============================================================================
// TRANSFORMER FUNCTION
// ============================================================================

export function transformCompanyComparisonToViewModel(raw: any): ComparisonViewModel {
  // Extract data from API response structure
  const comparisonData = raw.comparisonData || {};
  const overall = comparisonData.overall || {};
  const perPolicySummary = overall.perPolicySummary || [];
  const policyComparisons = comparisonData.policyComparisons || [];
  
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

  // Transform highlights from all policies with savings
  const highlights: ComparisonHighlightView[] = [];
  let highlightId = 0;
  
  policyComparisons.forEach((policy: any) => {
    const policySavings = policy.costSummary?.annualSavings ?? 0;
    if (policySavings > 0 && policy.highlights) {
      policy.highlights.forEach((h: any) => {
        highlights.push({
          id: `highlight-${highlightId++}`,
          title: h.title || "",
          description: h.description || null,
          kind: determineHighlightKind(h.title || "", h.category || ""),
        });
      });
    }
  });

  // Transform coverage rows - prefer "hus" policy, fallback to first
  const preferredPolicy = policyComparisons.find((p: any) => 
    p.policyType === "hus" || p.policyType === "fritidshus"
  ) || policyComparisons[0];
  
  const coverageRows: ComparisonCoverageRowView[] = [];
  if (preferredPolicy?.coverageComparison?.rows) {
    preferredPolicy.coverageComparison.rows.forEach((row: any) => {
      coverageRows.push({
        coverageLabel: row.coverage || "Dækning",
        coverageDescription: row.description || null,
        currentValue: formatCoverageValue(row.current),
        offerValue: formatCoverageValue(row.offer),
        currentVariant: getVariantFromStatus(row.current?.status),
        offerVariant: getVariantFromStatus(row.offer?.status),
        note: row.note || null,
      });
    });
  }

  // Transform savings over time - generate series per policy type
  let savingsOverTime: SavingsOverTimeView | null = null;

  if (policyComparisons && policyComparisons.length > 0) {
    const series: SavingsSeriesView[] = policyComparisons
      .map((p: any) => {
        // Extract savings from costSummary or calculate from premiums
        const currentAnnual = p.costSummary?.currentAnnual ?? p.currentAnnual ?? null;
        const offerAnnual = p.costSummary?.offerAnnual ?? p.offerAnnual ?? null;
        const annualSavings = 
          p.costSummary?.annualSavings ??
          (currentAnnual != null && offerAnnual != null
            ? currentAnnual - offerAnnual
            : 0);

        // Skip policies with no savings data
        if (annualSavings === 0 && currentAnnual === null && offerAnnual === null) {
          return null;
        }

        const monthlySavings = annualSavings / 12;
        const tenYearSavings = annualSavings * 10;

        // Generate 120 monthly cumulative data points
        const points = Array.from({ length: 120 }, (_, i) => {
          const month = i + 1;
          return { month, cumulative: monthlySavings * month };
        });

        return {
          key: p.policyType,
          label: p.label || capitalizeFirst(p.policyType),
          annualSavings,
          monthlySavings,
          tenYearSavings,
          points,
        };
      })
      .filter((s: SavingsSeriesView | null): s is SavingsSeriesView => s !== null);

    if (series.length > 0) {
      const totalAnnualSavings = series.reduce((sum, s) => sum + s.annualSavings, 0);
      const totalTenYearSavings = series.reduce((sum, s) => sum + s.tenYearSavings, 0);

      savingsOverTime = {
        totalAnnualSavings,
        totalTenYearSavings,
        series,
      };
    }
  }

  // Generate tab views
  const tabs = generateTabViews({
    policyComparisons,
    perPolicySummary,
    overallView,
    policies,
    highlights,
    coverageRows,
    savingsOverTime,
  });

  return {
    id: raw.id,
    offerCompanyName,
    currentCompanyName,
    overall: overallView,
    policies,
    highlights,
    coverageRows,
    savingsOverTime,
    tabs,
    defaultTab: "samlet",
  };
}

// ============================================================================
// TAB GENERATION
// ============================================================================

interface TabGenerationInput {
  policyComparisons: any[];
  perPolicySummary: any[];
  overallView: ComparisonOverallView;
  policies: ComparisonPolicyRowView[];
  highlights: ComparisonHighlightView[];
  coverageRows: ComparisonCoverageRowView[];
  savingsOverTime: SavingsOverTimeView | null;
}

function generateTabViews(input: TabGenerationInput): Record<ComparisonTabKey, ComparisonTabView> {
  const {
    policyComparisons,
    perPolicySummary,
    overallView,
    policies,
    highlights,
    coverageRows,
    savingsOverTime,
  } = input;

  const tabs: Record<ComparisonTabKey, ComparisonTabView> = {
    samlet: {
      key: "samlet",
      label: "Samlet",
      policyType: null,
      isAvailable: true,
      summary: {
        annualSavings: overallView.annualSavings,
        totalCurrentAnnual: overallView.totalCurrentAnnual,
        totalOfferAnnual: overallView.totalOfferAnnual,
        savingsPercent: overallView.savingsPercent ?? 0,
      },
      quickRows: policies,
      highlights,
      coverageRows,
      savingsOverTime,
    },
    indbo: generatePolicyTab("indbo", "Indbo", policyComparisons, perPolicySummary),
    hus: generatePolicyTab("hus", "Hus", policyComparisons, perPolicySummary),
    ulykke: generatePolicyTab("ulykke", "Ulykke", policyComparisons, perPolicySummary),
    bil: generatePolicyTab("bil", "Bil", policyComparisons, perPolicySummary),
    rejse: generatePolicyTab("rejse", "Rejse", policyComparisons, perPolicySummary),
  };

  return tabs;
}

function generatePolicyTab(
  policyType: string,
  label: string,
  policyComparisons: any[],
  perPolicySummary: any[]
): ComparisonTabView {
  // Find the policy comparison data for this type
  const policyComp = policyComparisons.find((p: any) => p.policyType === policyType);
  const policySummary = perPolicySummary.find((p: any) => p.policyType === policyType);

  if (!policyComp || !policySummary) {
    // Policy not available - return empty tab
    return {
      key: policyType as ComparisonTabKey,
      label,
      policyType,
      isAvailable: false,
      summary: {
        annualSavings: 0,
        totalCurrentAnnual: 0,
        totalOfferAnnual: 0,
        savingsPercent: 0,
      },
      quickRows: [],
      highlights: [],
      coverageRows: [],
      savingsOverTime: null,
    };
  }

  // Extract cost data
  const currentAnnual = policySummary.currentAnnualPremium ?? 0;
  const offerAnnual = policySummary.offerAnnualPremium ?? 0;
  const annualSavings = policySummary.annualSavings ?? 0;
  const savingsPercent = currentAnnual > 0 
    ? ((currentAnnual - offerAnnual) / currentAnnual) * 100
    : 0;

  // Create quick row for this policy
  const quickRows: ComparisonPolicyRowView[] = [{
    policyType,
    label: policySummary.label || capitalizeFirst(policyType),
    currentAnnual,
    offerAnnual,
    savingsAnnual: annualSavings,
    cheaperThanCurrent: offerAnnual < currentAnnual,
  }];

  // Extract highlights for this policy
  const policyHighlights: ComparisonHighlightView[] = [];
  let highlightId = 0;
  
  if (policyComp.highlights) {
    policyComp.highlights.forEach((h: any) => {
      policyHighlights.push({
        id: `highlight-${policyType}-${highlightId++}`,
        title: h.title || "",
        description: h.description || null,
        kind: determineHighlightKind(h.title || "", h.category || ""),
      });
    });
  }

  // Extract coverage rows for this policy
  const policyCoverageRows: ComparisonCoverageRowView[] = [];
  if (policyComp.coverageComparison?.rows) {
    policyComp.coverageComparison.rows.forEach((row: any) => {
      policyCoverageRows.push({
        coverageLabel: row.coverage || "Dækning",
        coverageDescription: row.description || null,
        currentValue: formatCoverageValue(row.current),
        offerValue: formatCoverageValue(row.offer),
        currentVariant: getVariantFromStatus(row.current?.status),
        offerVariant: getVariantFromStatus(row.offer?.status),
        note: row.note || null,
      });
    });
  }

  // Generate savings chart for this single policy
  const monthlySavings = annualSavings / 12;
  const tenYearSavings = annualSavings * 10;
  
  const points = Array.from({ length: 120 }, (_, i) => {
    const month = i + 1;
    return { month, cumulative: monthlySavings * month };
  });

  const seriesView: SavingsSeriesView = {
    key: policyType,
    label,
    annualSavings,
    monthlySavings,
    tenYearSavings,
    points,
  };

  const policySavingsOverTime: SavingsOverTimeView = {
    totalAnnualSavings: annualSavings,
    totalTenYearSavings: tenYearSavings,
    series: [seriesView],
  };

  // Extract snapshot IDs from policy comparison data
  const offerSnapshotId = policyComp.offerPolicyId || null;
  const currentSnapshotId = policyComp.currentPolicyId || null;

  return {
    key: policyType as ComparisonTabKey,
    label,
    policyType,
    isAvailable: true,
    offerSnapshotId,
    currentSnapshotId,
    summary: {
      annualSavings,
      totalCurrentAnnual: currentAnnual,
      totalOfferAnnual: offerAnnual,
      savingsPercent,
    },
    quickRows,
    highlights: policyHighlights,
    coverageRows: policyCoverageRows,
    savingsOverTime: policySavingsOverTime,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function determineHighlightKind(title: string, category: string): ComparisonHighlightView["kind"] {
  const text = (title + " " + category).toLowerCase();
  
  if (text.includes("dækningssum") || text.includes("sum") || text.includes("højere")) {
    return "coverage_up";
  }
  if (text.includes("selvrisiko") || text.includes("lavere") || text.includes("deductible")) {
    return "deductible_down";
  }
  if (text.includes("vejhjælp") || text.includes("vejservice") || text.includes("roadside")) {
    return "service_extra";
  }
  if (text.includes("sensor") || text.includes("alarm") || text.includes("hardware") || text.includes("smart")) {
    return "tech_extra";
  }
  
  return "generic";
}

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
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

  return "—";
}

function getVariantFromStatus(status: string | undefined): "success" | "error" | "neutral" {
  if (!status) return "neutral";
  
  const statusLower = status.toLowerCase();
  
  if (statusLower === "included" || statusLower === "success") {
    return "success";
  }
  
  if (statusLower === "excluded" || statusLower === "error") {
    return "error";
  }
  
  if (statusLower === "warning" || statusLower === "partial") {
    return "neutral";
  }

  return "neutral";
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
