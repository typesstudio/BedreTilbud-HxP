import type { HealthCheckBenefit } from "@/components/healthCheck/HealthCheckBenefitsGrid";
import type { HealthCheckItem } from "@/components/healthCheck/HealthCheckStrengthsWeaknesses";
import type { ComparisonCoverageRowView } from "./transformComparison";

export interface SiblingSnapshot {
  id: string;
  policyType: string;
  companyName: string;
}

export interface HealthCheckApiResponse {
  snapshot: {
    id: string;
    companyName: string;
    policyType: string;
    kind: "current" | "offer";
    pricing?: {
      annualPremium: number;
    };
  };
  healthCheck: {
    result: any;
  } | null;
  siblingSnapshots?: SiblingSnapshot[];
  documentId?: string;
  comparisonId?: string | null;
}

export interface PolicyTab {
  policyType: string;
  label: string;
  snapshotId: string;
  isActive: boolean;
}

export interface HealthCheckViewModel {
  title: string;
  subtitle: string;
  companyName: string;
  policyTypeLabel: string;
  policyType: string;
  kind: "current" | "offer";
  snapshotId: string;
  documentId?: string;
  comparisonId?: string | null;
  annualPotentialSavings?: number;
  annualSavingsPercent?: number;
  benefits: HealthCheckBenefit[];
  coverageRows: ComparisonCoverageRowView[];
  strengths: HealthCheckItem[];
  weaknesses: HealthCheckItem[];
  savingsOverTime?: {
    chartData: { label: string; Besparelse: number }[];
    monthlyRangeText?: string;
    totalAfter12Months: number;
    totalAfter10Years: number;
  };
  siblingTabs: PolicyTab[];
}

const policyTypeLabels: { [key: string]: string } = {
  indbo: "Indbo",
  ulykke: "Ulykke",
  hus: "Hus",
  fritidshus: "Fritidshus",
  bil: "Bil",
  rejse: "Rejse",
};

const policyTypeOrder = ["indbo", "ulykke", "hus", "fritidshus", "bil", "rejse"];

export function transformPolicyHealthCheckToView(
  apiData: HealthCheckApiResponse
): HealthCheckViewModel {
  const { snapshot, healthCheck, siblingSnapshots, documentId, comparisonId } = apiData;
  const policyTypeLabel = policyTypeLabels[snapshot.policyType] || snapshot.policyType;

  // Build sibling tabs from sibling snapshots, ordered by policy type
  // IMPORTANT: Deduplicate by policyType (not just id) to handle cases where
  // both offer_snapshots and policy_snapshots exist for the same document/policyType
  const siblingTabs: PolicyTab[] = [];
  
  // Use a Map to deduplicate by policyType, preferring the current snapshot's ID
  // for its policy type, and the first sibling for other policy types
  const policyTypeToSnapshot = new Map<string, SiblingSnapshot>();
  
  // First, add all siblings to the map
  if (siblingSnapshots && siblingSnapshots.length > 0) {
    for (const sibling of siblingSnapshots) {
      // Only add if we haven't seen this policyType yet
      if (!policyTypeToSnapshot.has(sibling.policyType)) {
        policyTypeToSnapshot.set(sibling.policyType, sibling);
      }
    }
  }
  
  // Override with current snapshot for its policyType (ensures correct active state)
  policyTypeToSnapshot.set(snapshot.policyType, {
    id: snapshot.id,
    policyType: snapshot.policyType,
    companyName: snapshot.companyName,
  });
  
  // Convert map to array and sort by policy type order
  const uniqueSnapshots = Array.from(policyTypeToSnapshot.values());
  const sortedSnapshots = uniqueSnapshots.sort((a, b) => {
    const aIndex = policyTypeOrder.indexOf(a.policyType);
    const bIndex = policyTypeOrder.indexOf(b.policyType);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  // Build tabs from sorted, deduplicated snapshots
  for (const snap of sortedSnapshots) {
    siblingTabs.push({
      policyType: snap.policyType,
      label: policyTypeLabels[snap.policyType] || snap.policyType,
      snapshotId: snap.id,
      isActive: snap.id === snapshot.id,
    });
  }
  
  // Extract health check result
  const result = healthCheck?.result || {};
  const potentialSavings = result.potentialSavings || {};
  const whatsIncludedData = result.whatsIncluded || [];
  const strengthsData = result.strengths || [];
  const weaknessesData = result.weaknesses || [];
  const cumulativeSavingsData = result.cumulativeSavings || {};
  // API returns 'highlights' as the benefits/features array
  const benefitsData = result.highlights || result.benefits || [];

  // Transform benefits for the grid
  const benefits: HealthCheckBenefit[] = benefitsData.map((item: any, index: number) => ({
    id: `benefit-${index}`,
    title: item.title || item.name || "",
    description: item.description || "",
    icon: item.icon,
    variant: item.variant || "neutral",
  }));

  // Transform coverages to coverage rows format for ComparisonDetailedMatrix
  const coverageRows: ComparisonCoverageRowView[] = whatsIncludedData.map((item: any, index: number) => {
    let value = "inkluderet";
    let variant: "success" | "neutral" | "warning" | "error" = "success";

    if (item.value === "ikke inkluderet") {
      value = "ikke inkluderet";
      variant = item.status || "neutral";
    } else if (item.attributes?.selvrisiko) {
      value = `Selvrisiko: ${item.attributes.selvrisiko}`;
      variant = item.status || "warning";
    } else if (item.attributes?.sum) {
      value = item.attributes.sum;
      variant = item.status || "success";
    } else if (item.value) {
      value = item.value;
      variant = item.status || "success";
    }

    return {
      coverageLabel: item.coverage || item.name || "",
      coverageDescription: item.description || undefined,
      currentValue: "",
      currentVariant: "neutral",
      offerValue: value,
      offerVariant: variant,
      note: undefined,
    };
  });

  // Transform strengths
  const strengths: HealthCheckItem[] = strengthsData.map((item: any, index: number) => ({
    id: `strength-${index}`,
    title: item.title || item.name || "",
    description: item.description || "",
    amountText: item.amountText || item.amount,
  }));

  // Transform weaknesses
  const weaknesses: HealthCheckItem[] = weaknessesData.map((item: any, index: number) => ({
    id: `weakness-${index}`,
    title: item.title || item.name || "",
    description: item.description || "",
    amountText: item.amountText || item.amount,
  }));

  // Transform cumulative savings for ComparisonSavingsChart
  let savingsOverTime: HealthCheckViewModel["savingsOverTime"] | undefined;
  if (cumulativeSavingsData.chartData && cumulativeSavingsData.chartData.length > 0) {
    const chartData = cumulativeSavingsData.chartData.map((item: any) => ({
      label: item.month || item.label || "",
      Besparelse: item.savings || item.value || 0,
    }));

    const after12Months = cumulativeSavingsData.after12Months || (potentialSavings.realistic || 0);
    const after10Years = cumulativeSavingsData.after10Years || cumulativeSavingsData.totalOver10Years || (after12Months * 10);

    // Build monthly range text from monthlyRange object if available
    let monthlyRangeText = cumulativeSavingsData.monthlyRangeText;
    if (!monthlyRangeText && cumulativeSavingsData.monthlyRange) {
      const { min, max } = cumulativeSavingsData.monthlyRange;
      if (min !== undefined && max !== undefined && (min > 0 || max > 0)) {
        monthlyRangeText = min === max ? `${min} kr` : `${min}-${max} kr`;
      }
    }

    savingsOverTime = {
      chartData,
      monthlyRangeText,
      totalAfter12Months: after12Months,
      totalAfter10Years: after10Years,
    };
  } else if (potentialSavings.realistic) {
    // If we have annual savings but no chart data, generate a simple projection
    const annualSavings = potentialSavings.realistic;
    const monthlySavings = annualSavings / 12;
    
    const chartData = [];
    for (let year = 1; year <= 10; year++) {
      chartData.push({
        label: `År ${year}`,
        Besparelse: annualSavings * year,
      });
    }

    savingsOverTime = {
      chartData,
      totalAfter12Months: annualSavings,
      totalAfter10Years: annualSavings * 10,
    };
  }

  // Get annual savings - try multiple sources for compatibility
  const annualSavingsResult = result.annualSavings || {};
  const annualPotentialSavings = potentialSavings.realistic 
    || annualSavingsResult.amount 
    || 0;
  
  // Only set percentage if we have a valid source - don't default to 0
  let annualSavingsPercent: number | undefined;
  if (potentialSavings.percentage != null && potentialSavings.percentage > 0) {
    annualSavingsPercent = potentialSavings.percentage;
  } else if (annualSavingsResult.percentageLower != null && annualSavingsResult.percentageLower > 0) {
    annualSavingsPercent = annualSavingsResult.percentageLower;
  } else if (potentialSavings.realistic && cumulativeSavingsData.monthlyRange?.max) {
    // Calculate percentage from cumulative savings data if available
    const monthlyMax = cumulativeSavingsData.monthlyRange.max;
    const annualCost = monthlyMax * 12 + potentialSavings.realistic;
    if (annualCost > 0) {
      annualSavingsPercent = Math.round((potentialSavings.realistic / annualCost) * 100 * 10) / 10;
    }
  }
  // If still undefined, leave it undefined (don't show percentage)

  return {
    title: `${policyTypeLabel} sundhedstjek`,
    subtitle: snapshot.kind === "offer" 
      ? `Se en grundig analyse af ${snapshot.companyName}'s tilbud`
      : "Se en grundig analyse af din nuværende forsikring",
    companyName: snapshot.companyName,
    policyTypeLabel,
    policyType: snapshot.policyType,
    kind: snapshot.kind,
    snapshotId: snapshot.id,
    documentId,
    comparisonId,
    annualPotentialSavings,
    annualSavingsPercent,
    benefits,
    coverageRows,
    strengths,
    weaknesses,
    savingsOverTime,
    siblingTabs,
  };
}

