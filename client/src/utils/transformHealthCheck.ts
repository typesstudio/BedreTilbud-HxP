import type { HealthCheckBenefit } from "@/components/healthCheck/HealthCheckBenefitsGrid";
import type { HealthCheckItem } from "@/components/healthCheck/HealthCheckStrengthsWeaknesses";
import type { ComparisonCoverageRowView } from "./transformComparison";

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
}

export interface HealthCheckViewModel {
  title: string;
  subtitle: string;
  companyName: string;
  policyTypeLabel: string;
  policyType: string;
  kind: "current" | "offer";
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
}

const policyTypeLabels: { [key: string]: string } = {
  indbo: "Indbo",
  ulykke: "Ulykke",
  hus: "Hus",
  fritidshus: "Fritidshus",
  bil: "Bil",
  rejse: "Rejse",
};

export function transformPolicyHealthCheckToView(
  apiData: HealthCheckApiResponse
): HealthCheckViewModel {
  const { snapshot, healthCheck } = apiData;
  const policyTypeLabel = policyTypeLabels[snapshot.policyType] || snapshot.policyType;
  
  // Extract health check result
  const result = healthCheck?.result || {};
  const potentialSavings = result.potentialSavings || {};
  const whatsIncludedData = result.whatsIncluded || [];
  const strengthsData = result.strengths || [];
  const weaknessesData = result.weaknesses || [];
  const cumulativeSavingsData = result.cumulativeSavings || {};
  const benefitsData = result.benefits || [];

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
    const after10Years = cumulativeSavingsData.after10Years || (after12Months * 10);

    savingsOverTime = {
      chartData,
      monthlyRangeText: cumulativeSavingsData.monthlyRangeText,
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

  return {
    title: `${policyTypeLabel} sundhedstjek`,
    subtitle: snapshot.kind === "offer" 
      ? `Se en grundig analyse af ${snapshot.companyName}'s tilbud`
      : "Se en grundig analyse af din nuværende forsikring",
    companyName: snapshot.companyName,
    policyTypeLabel,
    policyType: snapshot.policyType,
    kind: snapshot.kind,
    annualPotentialSavings: potentialSavings.realistic,
    annualSavingsPercent: potentialSavings.percentage,
    benefits,
    coverageRows,
    strengths,
    weaknesses,
    savingsOverTime,
  };
}

