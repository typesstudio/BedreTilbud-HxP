import {
  ComparisonViewModel,
  ComparisonPolicyRow,
} from "@/components/comparison/ComparisonPageLayout";
import {
  FeatherHome,
  FeatherBuilding,
  FeatherShield,
  FeatherCar,
  FeatherPlane,
} from "@subframe/core";

const policyIconForType: Record<string, any> = {
  indbo: FeatherHome,
  hus: FeatherBuilding,
  ulykke: FeatherShield,
  bil: FeatherCar,
  rejse: FeatherPlane,
};

const policyLabelForType: Record<string, string> = {
  indbo: "Indbo",
  hus: "Hus",
  ulykke: "Ulykke",
  bil: "Bil",
  rejse: "Rejse",
};

export function transformCompanyComparisonToViewModel(apiData: any): ComparisonViewModel {
  // Extract company names
  const currentCompanyName = apiData.currentDocument?.ocrData?.companyName || "Din nuværende";
  const offerCompanyName = apiData.offerDocument?.ocrData?.companyName || "Tilbud";

  // Extract overall stats from the comparison data
  const comparisonData = apiData.comparisonData || {};
  const overall = comparisonData.overall ?? {};
  const perPolicySummary = overall.perPolicySummary || [];

  // Transform per-policy data
  const policyRows: ComparisonPolicyRow[] = perPolicySummary.map((p: any) => {
    const IconComponent = policyIconForType[p.policyType] ?? FeatherHome;
    const label = policyLabelForType[p.policyType] ?? p.label ?? p.policyType;

    return {
      policyType: p.policyType,
      label,
      icon: <IconComponent />,
      currentAnnual: p.currentAnnualPremium ?? null,
      offerAnnual: p.offerAnnualPremium ?? null,
      annualSavings: p.annualSavings ?? null,
      statusLabel: p.annualSavings ? "Godkendt" : "Afventer",
      statusVariant: p.annualSavings ? "success" : "warning",
    };
  });

  return {
    title: `${offerCompanyName} sammenligning`,
    subtitle: `Sammenlign dit nuværende tilbud med ${offerCompanyName}`,
    currentCompanyName,
    offerCompanyName,
    totalAnnualSavings: overall.annualSavings ?? apiData.savings ?? 0,
    totalSavingsPercent: overall.annualSavingsPercent ?? apiData.savingsPercentage ?? 0,
    totalCurrentAnnual: overall.totalCurrentAnnualPremium ?? apiData.currentDocument?.ocrData?.annualPremium ?? 0,
    totalOfferAnnual: overall.totalOfferAnnualPremium ?? apiData.offerDocument?.ocrData?.annualPremium ?? 0,
    policies: policyRows,
    canOpenMessages: !!apiData.companyId,
    messageCtaLabel: "Se beskeder",
    canOpenHealthCheck: true,
  };
}
