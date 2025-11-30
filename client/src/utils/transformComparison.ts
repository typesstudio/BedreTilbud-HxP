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
      const currentValue = formatCoverageValue(row.current);
      const offerValue = formatCoverageValue(row.offer);
      
      coverageRows.push({
        coverageLabel: row.coverage || "Dækning",
        coverageDescription: row.description || null,
        currentValue,
        offerValue,
        currentVariant: getCurrentVariantWithComparison(
          currentValue,
          offerValue,
          row.current?.status,
          row.offer?.status
        ),
        offerVariant: getOfferVariantWithComparison(
          currentValue,
          offerValue,
          row.current?.status,
          row.offer?.status
        ),
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
      const currentValue = formatCoverageValue(row.current);
      const offerValue = formatCoverageValue(row.offer);
      
      policyCoverageRows.push({
        coverageLabel: row.coverage || "Dækning",
        coverageDescription: row.description || null,
        currentValue,
        offerValue,
        currentVariant: getCurrentVariantWithComparison(
          currentValue,
          offerValue,
          row.current?.status,
          row.offer?.status
        ),
        offerVariant: getOfferVariantWithComparison(
          currentValue,
          offerValue,
          row.current?.status,
          row.offer?.status
        ),
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

/**
 * Parse a Danish-formatted number from a string like "500.000 kr." or "1.000.000"
 * Handles ranges like "10.000-20.000 kr." by extracting the highest value
 * Returns null if no valid number can be extracted
 */
function parseNumericValue(value: string | null | undefined): number | null {
  if (!value) return null;
  
  const valueLower = value.toLowerCase().trim();
  
  // Skip text-only values - check for common non-numeric patterns
  if (valueLower.startsWith('inkluderet') || 
      valueLower.startsWith('ikke inkluderet') ||
      valueLower === 'ja' || valueLower === 'nej' ||
      valueLower === 'yes' || valueLower === 'no' ||
      valueLower.startsWith('som ') ||  // "Som nuværende"
      valueLower.startsWith('afventer') ||
      valueLower.startsWith('ukendt') ||
      valueLower === '—' || valueLower === '-') {
    return null;
  }
  
  // Handle ranges like "10.000-20.000" or "10.000–20.000" (em dash)
  // Extract all number-like segments and take the maximum
  const numberSegments = value.split(/[-–—]/); // Split on various dash types
  
  let maxValue: number | null = null;
  
  for (const segment of numberSegments) {
    // First, remove all common suffixes/text to isolate numeric part
    let cleaned = segment.toLowerCase()
      .replace(/kr\.?/gi, '')
      .replace(/dkk/gi, '')
      .replace(/pr\.?\s*(år|måned|md)/gi, '') // Remove "pr. år", "pr. måned"
      .replace(/årligt|månedligt/gi, '')
      .replace(/,-/g, '')
      .trim();
    
    // Now extract only digits, dots, and commas
    cleaned = cleaned.replace(/[^\d.,]/g, '');
    
    // Remove trailing/leading dots and commas
    cleaned = cleaned.replace(/^[.,]+|[.,]+$/g, '');
    
    if (!cleaned) continue;
    
    // Danish format uses . as thousands separator and , as decimal
    // Check if it has both . and , - if so, . is thousands separator
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes('.')) {
      // Only dots - check if it looks like thousands separator (e.g., 500.000)
      const parts = cleaned.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length === 3) {
        // Likely thousands separator
        cleaned = cleaned.replace(/\./g, '');
      }
    } else if (cleaned.includes(',')) {
      // Only comma - likely decimal separator
      cleaned = cleaned.replace(',', '.');
    }
    
    const parsed = parseFloat(cleaned);
    // Accept zero as a valid value (e.g., "0 kr." for deductibles)
    if (!isNaN(parsed) && parsed >= 0 && (maxValue === null || parsed > maxValue)) {
      maxValue = parsed;
    }
  }
  
  return maxValue;
}

/**
 * Check if a value represents "inkluderet" (included)
 * Handles variants like "inkluderet (tilvalg)", "Ja", "Yes"
 */
function isIncludedValue(value: string | null | undefined, status: string | undefined): boolean {
  if (status) {
    const statusLower = status.toLowerCase();
    if (statusLower === 'included' || statusLower === 'success') return true;
    if (statusLower === 'excluded' || statusLower === 'error') return false;
  }
  
  if (value) {
    const valueLower = value.toLowerCase().trim();
    // Match "inkluderet" at start (handles "inkluderet (tilvalg)", etc.)
    if (valueLower.startsWith('inkluderet')) return true;
    // Match simple yes values
    if (valueLower === 'ja' || valueLower === 'yes') return true;
  }
  
  return false;
}

/**
 * Check if a value represents "ikke inkluderet" (excluded)
 * Handles variants like "ikke inkluderet – se note", "Nej", "No"
 */
function isExcludedValue(value: string | null | undefined, status: string | undefined): boolean {
  if (status) {
    const statusLower = status.toLowerCase();
    if (statusLower === 'excluded' || statusLower === 'error') return true;
    if (statusLower === 'included' || statusLower === 'success') return false;
  }
  
  if (value) {
    const valueLower = value.toLowerCase().trim();
    // Match "ikke inkluderet" at start (handles "ikke inkluderet – se note", etc.)
    if (valueLower.startsWith('ikke inkluderet')) return true;
    // Match simple no values
    if (valueLower === 'nej' || valueLower === 'no') return true;
  }
  
  return false;
}

/**
 * Check if a value is truly empty/missing (not just informative text)
 */
function isTrulyEmptyValue(value: string | null | undefined): boolean {
  if (!value) return true;
  const valueLower = value.toLowerCase().trim();
  return valueLower === '' || valueLower === '—' || valueLower === '-';
}

/**
 * Determine badge variant for offer column based on comparison with current value
 * Rules:
 * - "inkluderet" = green (success)
 * - "ikke inkluderet" = red (error)  
 * - Numeric: offer > current = green, offer < current = red
 * - One-sided: only mark success/error when other side is truly empty or excluded
 */
function getOfferVariantWithComparison(
  currentValue: string | null,
  offerValue: string | null,
  currentStatus: string | undefined,
  offerStatus: string | undefined
): "success" | "error" | "neutral" {
  // Rule 1: Check if offer is "inkluderet" (from status OR text value)
  if (isIncludedValue(offerValue, offerStatus)) {
    return "success";
  }
  
  // Rule 2: Check if offer is "ikke inkluderet" (from status OR text value)
  if (isExcludedValue(offerValue, offerStatus)) {
    return "error";
  }
  
  // Rule 3: Numeric comparison - higher is better (more coverage)
  const currentNum = parseNumericValue(currentValue);
  const offerNum = parseNumericValue(offerValue);
  
  if (currentNum !== null && offerNum !== null) {
    if (offerNum > currentNum) {
      return "success"; // Offer is better (higher coverage)
    } else if (offerNum < currentNum) {
      return "error"; // Offer is worse (lower coverage)
    }
    // Equal values - neutral
    return "neutral";
  }
  
  // Rule 4: One-sided comparison - be conservative
  // Only mark success if offer has a value AND current is truly excluded or empty
  if (offerNum !== null && (isExcludedValue(currentValue, currentStatus) || isTrulyEmptyValue(currentValue))) {
    return "success";
  }
  // Only mark error if current has a value AND offer is truly excluded or empty
  if (currentNum !== null && (isExcludedValue(offerValue, offerStatus) || isTrulyEmptyValue(offerValue))) {
    return "error";
  }
  
  // If one side is numeric but other is just informative text, stay neutral
  return "neutral";
}

/**
 * Determine badge variant for current column based on comparison with offer value
 * Rules:
 * - "inkluderet" = green (success)
 * - "ikke inkluderet" = red (error)
 * - Numeric: current > offer = green, current < offer = red
 * - One-sided: only mark success/error when other side is truly empty or excluded
 */
function getCurrentVariantWithComparison(
  currentValue: string | null,
  offerValue: string | null,
  currentStatus: string | undefined,
  offerStatus: string | undefined
): "success" | "error" | "neutral" {
  // Rule 1: Check if current is "inkluderet" (from status OR text value)
  if (isIncludedValue(currentValue, currentStatus)) {
    return "success";
  }
  
  // Rule 2: Check if current is "ikke inkluderet" (from status OR text value)
  if (isExcludedValue(currentValue, currentStatus)) {
    return "error";
  }
  
  // Rule 3: Numeric comparison - higher is better
  const currentNum = parseNumericValue(currentValue);
  const offerNum = parseNumericValue(offerValue);
  
  if (currentNum !== null && offerNum !== null) {
    if (currentNum > offerNum) {
      return "success"; // Current is better (higher coverage)
    } else if (currentNum < offerNum) {
      return "error"; // Current is worse (lower coverage)
    }
    // Equal values - neutral
    return "neutral";
  }
  
  // Rule 4: One-sided comparison - be conservative
  // Only mark success if current has a value AND offer is truly excluded or empty
  if (currentNum !== null && (isExcludedValue(offerValue, offerStatus) || isTrulyEmptyValue(offerValue))) {
    return "success";
  }
  // Only mark error if offer has a value AND current is truly excluded or empty
  if (offerNum !== null && (isExcludedValue(currentValue, currentStatus) || isTrulyEmptyValue(currentValue))) {
    return "error";
  }
  
  // If one side is numeric but other is just informative text, stay neutral
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
