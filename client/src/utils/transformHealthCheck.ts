import type { HealthCheckLayoutProps, CoverageItem, StrengthWeaknessItem, CumulativeSavings } from "@/components/health/HealthCheckLayout";

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
): HealthCheckLayoutProps {
  const { snapshot, healthCheck } = apiData;
  const policyTypeLabel = policyTypeLabels[snapshot.policyType] || snapshot.policyType;
  
  // Extract health check result
  const result = healthCheck?.result || {};
  const potentialSavings = result.potentialSavings || {};
  const whatsIncludedData = result.whatsIncluded || [];
  const strengthsData = result.strengths || [];
  const weaknessesData = result.weaknesses || [];
  const cumulativeSavingsData = result.cumulativeSavings || {};
  const missingInfoData = result.missingInfo || [];

  // Transform coverages
  const whatsIncluded: CoverageItem[] = whatsIncludedData.map((item: any, index: number) => ({
    id: `coverage-${index}`,
    coverage: item.coverage || item.name || "",
    description: item.description || "",
    value: item.value,
    status: item.status,
    attributes: item.attributes || {},
  }));

  // Transform strengths
  const strengths: StrengthWeaknessItem[] = strengthsData.map((item: any, index: number) => ({
    id: `strength-${index}`,
    title: item.title || item.name || "",
    description: item.description || "",
    icon: item.icon,
    variant: "success",
  }));

  // Transform weaknesses
  const weaknesses: StrengthWeaknessItem[] = weaknessesData.map((item: any, index: number) => ({
    id: `weakness-${index}`,
    title: item.title || item.name || "",
    description: item.description || "",
    icon: item.icon,
    variant: "warning",
  }));

  // Transform cumulative savings
  let cumulativeSavings: CumulativeSavings | undefined;
  if (cumulativeSavingsData.chartData && cumulativeSavingsData.chartData.length > 0) {
    cumulativeSavings = {
      chartData: cumulativeSavingsData.chartData.map((item: any) => ({
        month: item.month || item.label || "",
        savings: item.savings || item.value || 0,
      })),
      after12Months: cumulativeSavingsData.after12Months || 0,
      after10Years: cumulativeSavingsData.after10Years || 0,
      monthlyRange: cumulativeSavingsData.monthlyRange,
    };
  }

  // Transform missing info
  const missingInfo = missingInfoData.map((item: any, index: number) => ({
    id: `missing-${index}`,
    category: item.category || item.title || "",
    question: item.question || item.description || "",
    icon: item.icon,
    variant: item.variant || "error",
  }));

  // Build insurance details from snapshot
  const insuranceDetails = [
    {
      label: "Selskab",
      value: snapshot.companyName,
      variant: "neutral" as const,
    },
    {
      label: "Type",
      value: policyTypeLabel,
      variant: "neutral" as const,
    },
  ];

  if (snapshot.pricing?.annualPremium) {
    insuranceDetails.push({
      label: "Årlig præmie",
      value: `${snapshot.pricing.annualPremium} kr`,
      variant: "neutral" as const,
    });
  }

  return {
    title: `${policyTypeLabel} sundhedstjek`,
    subtitle: snapshot.kind === "offer" 
      ? `Se en grundig analyse af ${snapshot.companyName}'s tilbud`
      : "Se en grundig analyse af din nuværende forsikring",
    companyName: snapshot.companyName,
    policyTypeLabel,
    kind: snapshot.kind,
    quickStatus: potentialSavings.realistic
      ? {
          savingsAnnual: potentialSavings.realistic,
          savingsPercentage: potentialSavings.percentage,
        }
      : undefined,
    insuranceDetails,
    whatsIncluded: whatsIncluded.length > 0 ? whatsIncluded : undefined,
    strengths: strengths.length > 0 ? strengths : undefined,
    weaknesses: weaknesses.length > 0 ? weaknesses : undefined,
    cumulativeSavings,
    missingInfo: missingInfo.length > 0 ? missingInfo : undefined,
  };
}

// Transform current insurance health check (from InsuranceCheckPage format)
export function transformCurrentHealthCheckToView(policy: any): HealthCheckLayoutProps {
  const healthCheckPayload = policy.healthCheckPayload || {};
  const policyTypeLabel = policyTypeLabels[policy.policyType] || policy.policyType;

  // Extract data from healthCheckPayload
  const potentialSavings = healthCheckPayload.potentialSavings || {};
  const whatsIncludedData = healthCheckPayload.whatsIncluded || [];
  const strengthsData = healthCheckPayload.strengths || [];
  const weaknessesData = healthCheckPayload.weaknesses || [];
  const cumulativeSavingsData = healthCheckPayload.cumulativeSavings || {};
  const missingInfoData = healthCheckPayload.missingInfo || [];

  // Transform coverages
  const whatsIncluded: CoverageItem[] = whatsIncludedData.map((item: any, index: number) => ({
    id: `coverage-${index}`,
    coverage: item.coverage || item.name || "",
    description: item.description || "",
    value: item.value,
    status: item.status,
    attributes: item.attributes || {},
  }));

  // Transform strengths
  const strengths: StrengthWeaknessItem[] = strengthsData.map((item: any, index: number) => ({
    id: `strength-${index}`,
    title: item.title || item.name || "",
    description: item.description || "",
    icon: item.icon,
    variant: "success",
  }));

  // Transform weaknesses
  const weaknesses: StrengthWeaknessItem[] = weaknessesData.map((item: any, index: number) => ({
    id: `weakness-${index}`,
    title: item.title || item.name || "",
    description: item.description || "",
    icon: item.icon,
    variant: "warning",
  }));

  // Transform cumulative savings
  let cumulativeSavings: CumulativeSavings | undefined;
  if (cumulativeSavingsData.chartData && cumulativeSavingsData.chartData.length > 0) {
    cumulativeSavings = {
      chartData: cumulativeSavingsData.chartData.map((item: any) => ({
        month: item.month || item.label || "",
        savings: item.savings || item.value || 0,
      })),
      after12Months: cumulativeSavingsData.after12Months || 0,
      after10Years: cumulativeSavingsData.after10Years || 0,
      monthlyRange: cumulativeSavingsData.monthlyRange,
    };
  }

  // Transform missing info
  const missingInfo = missingInfoData.map((item: any, index: number) => ({
    id: `missing-${index}`,
    category: item.category || item.title || "",
    question: item.question || item.description || "",
    icon: item.icon,
    variant: item.variant || "error",
  }));

  // Build insurance details
  const insuranceDetails = [
    {
      label: "Selskab",
      value: policy.companyName || "Ukendt",
      variant: "neutral" as const,
    },
    {
      label: "Type",
      value: policyTypeLabel,
      variant: "neutral" as const,
    },
  ];

  if (policy.premium) {
    insuranceDetails.push({
      label: "Årlig præmie",
      value: policy.premium,
      variant: "neutral" as const,
    });
  }

  return {
    title: `${policyTypeLabel} sundhedstjek`,
    subtitle: "Se en grundig analyse af din nuværende forsikring",
    companyName: policy.companyName || "Din nuværende forsikring",
    policyTypeLabel,
    kind: "current",
    quickStatus: potentialSavings.realistic
      ? {
          savingsAnnual: potentialSavings.realistic,
          savingsPercentage: potentialSavings.percentage,
        }
      : undefined,
    insuranceDetails,
    whatsIncluded: whatsIncluded.length > 0 ? whatsIncluded : undefined,
    strengths: strengths.length > 0 ? strengths : undefined,
    weaknesses: weaknesses.length > 0 ? weaknesses : undefined,
    cumulativeSavings,
    missingInfo: missingInfo.length > 0 ? missingInfo : undefined,
  };
}
