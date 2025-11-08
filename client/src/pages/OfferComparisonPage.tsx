import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Badge,
  Button,
  IconWithBackground,
  ListingsTabs
} from "@/ui";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import {
  FeatherHome,
  FeatherShield,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
  FeatherTrendingUp,
  FeatherTrendingDown,
  FeatherCheck,
  FeatherAlertCircle
} from "@subframe/core";

const policyTypeLabels: { [key: string]: string } = {
  indbo: "Indbo",
  ulykke: "Ulykke",
  hus: "Hus",
  bil: "Bil",
  rejse: "Rejse"
};

const policyTypeIcons: { [key: string]: any } = {
  indbo: FeatherHome,
  ulykke: FeatherShield,
  hus: FeatherBuilding,
  bil: FeatherCar,
  rejse: FeatherPlane
};

const iconMap: { [key: string]: any } = {
  "trending-up": FeatherTrendingUp,
  "trending-down": FeatherTrendingDown,
  "shield": FeatherShield,
  "home": FeatherHome,
  "check": FeatherCheck,
  "alert-circle": FeatherAlertCircle
};

export default function OfferComparisonPage() {
  const { userId, companyId } = useParams<{ userId: string; companyId: string }>();
  const [selectedTab, setSelectedTab] = useState<string>("samlet");

  if (!userId || !companyId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-default-background">
        <div className="flex flex-col items-center gap-4">
          <span className="text-heading-2 font-heading-2 text-default-font">Sammenligning ikke fundet</span>
          <span className="text-body font-body text-subtext-color">Gå tilbage til forsiden</span>
        </div>
      </div>
    );
  }

  if (userId && localStorage.getItem('userId') !== userId) {
    localStorage.setItem('userId', userId);
  }

  const { data: comparisons, isLoading: comparisonsLoading } = useQuery<any[]>({
    queryKey: ['/api/sammenligning', userId, companyId],
  });

  const { data: combinedData, isLoading: combinedLoading } = useQuery<any>({
    queryKey: ['/api/sammenligning', userId, companyId, 'combined'],
  });

  const isLoading = comparisonsLoading || combinedLoading;

  if (isLoading) {
    return (
      <AppLayoutWithNav userId={userId}>
        <div className="flex items-center justify-center min-h-screen">
          <span className="text-body font-body text-subtext-color">Indlæser sammenligning...</span>
        </div>
      </AppLayoutWithNav>
    );
  }

  if (!comparisons || comparisons.length === 0) {
    return (
      <AppLayoutWithNav userId={userId}>
        <div className="flex items-center justify-center min-h-screen">
          <span className="text-body font-body text-default-font">Ingen sammenligninger fundet</span>
        </div>
      </AppLayoutWithNav>
    );
  }

  const company = comparisons && comparisons.length > 0 ? comparisons[0]?.company : null;
  const availablePolicyTypes = comparisons 
    ? Array.from(new Set(comparisons.map((c: any) => c.policyType).filter(Boolean))) 
    : [];

  const tabs = [
    {
      id: "samlet",
      label: "Samlet oversigt",
      count: availablePolicyTypes.length,
      Icon: undefined
    },
    ...availablePolicyTypes.map((type: string) => ({
      id: type,
      label: policyTypeLabels[type] || type,
      count: undefined,
      Icon: policyTypeIcons[type]
    }))
  ];

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "N/A";
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' kr';
  };

  const renderCombinedOverview = () => {
    if (!combinedData) return null;

    const verdictColors: { [key: string]: string } = {
      recommended: "success",
      consider: "warning",
      not_recommended: "error"
    };

    const verdictLabels: { [key: string]: string } = {
      recommended: "Anbefalet",
      consider: "Overvej",
      not_recommended: "Ikke anbefalet"
    };

    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-heading-2 font-heading-2 text-default-font">
              {company?.name || "Forsikringsselskab"}
            </span>
            <Badge variant={verdictColors[combinedData.verdict] as any}>
              {verdictLabels[combinedData.verdict] || combinedData.verdict}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <span className="text-body-bold font-body-bold text-subtext-color">Samlet besparelse</span>
              <span className="text-heading-1 font-heading-1 text-brand-600">
                {formatCurrency(combinedData.totalSavings)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                {combinedData.totalSavingsPercentage}% billigere
              </span>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <span className="text-body-bold font-body-bold text-subtext-color">Antal forsikringer</span>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {combinedData.policyCount}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Sammenlignede typer
              </span>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <span className="text-body-bold font-body-bold text-subtext-color">Status</span>
              <span className="text-heading-3 font-heading-3 text-default-font">
                {verdictLabels[combinedData.verdict]}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Samlet vurdering
              </span>
            </div>
          </div>
        </div>

        {combinedData.highlights && combinedData.highlights.length > 0 && (
          <div className="flex flex-col gap-4">
            <span className="text-heading-3 font-heading-3 text-default-font">Højdepunkter</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {combinedData.highlights.map((highlight: any, index: number) => {
                const Icon = iconMap[highlight.icon] || FeatherCheck;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <IconWithBackground
                      variant={highlight.variant as any}
                      size="medium"
                    >
                      <Icon className="text-default-font" />
                    </IconWithBackground>
                    <div className="flex flex-col gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {highlight.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {highlight.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {combinedData.quickComparison && combinedData.quickComparison.length > 0 && (
          <div className="flex flex-col gap-4">
            <span className="text-heading-3 font-heading-3 text-default-font">Hurtig oversigt</span>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-3 text-body-bold font-body-bold text-default-font">Type</th>
                    <th className="text-right p-3 text-body-bold font-body-bold text-default-font">Nuværende</th>
                    <th className="text-right p-3 text-body-bold font-body-bold text-default-font">Tilbud</th>
                    <th className="text-right p-3 text-body-bold font-body-bold text-default-font">Besparelse</th>
                    <th className="text-center p-3 text-body-bold font-body-bold text-default-font">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedData.quickComparison.map((row: any, index: number) => (
                    <tr key={index} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="p-3 text-body font-body text-default-font">
                        {policyTypeLabels[row.policyType] || row.policyType}
                      </td>
                      <td className="p-3 text-body font-body text-right text-subtext-color">
                        {formatCurrency(row.currentPremium)}
                      </td>
                      <td className="p-3 text-body font-body text-right text-subtext-color">
                        {formatCurrency(row.offerPremium)}
                      </td>
                      <td className="p-3 text-body-bold font-body-bold text-right text-brand-600">
                        {formatCurrency(row.savings)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={verdictColors[row.verdict] as any}>
                          {verdictLabels[row.verdict]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPolicyTypeComparison = (policyType: string) => {
    if (!comparisons) return null;
    const comparison = comparisons.find((c: any) => c.policyType === policyType);
    if (!comparison) return null;

    const comparisonData = comparison.comparisonData || {};
    const currentOcrData = comparison.currentPolicy?.ocrData || {};
    const offerOcrData = comparison.offerPolicy?.ocrData || {};
    const currentPremium = parseFloat(comparison.currentPolicy?.premium) || currentOcrData.annualPremium || 0;
    const offerPremium = parseFloat(comparison.offerPolicy?.premium) || offerOcrData.annualPremium || 0;
    const savings = currentPremium - offerPremium;
    const savingsPercentage = currentPremium > 0 ? ((savings / currentPremium) * 100) : 0;
    const highlights = comparisonData.highlights || [];
    const detailedComparison = comparisonData.detailedComparison || [];

    const isWorseOffer = savings < 0;
    const absoluteSavings = Math.abs(savings);
    const absoluteSavingsPercentage = Math.abs(savingsPercentage);

    const barWidthPercentage = offerPremium > 0 && currentPremium > 0
      ? Math.min((offerPremium / currentPremium) * 100, 100)
      : 80;

    return (
      <div className="flex flex-col gap-6 p-6 max-w-[768px] mx-auto">
        <div className="flex items-center justify-between">
          <span className="text-heading-2 font-heading-2 text-default-font">
            {policyTypeLabels[policyType]}
          </span>
          <Badge variant={isWorseOffer ? "error" : "success"}>
            {isWorseOffer ? "Dyrere" : "Billigere"}
          </Badge>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Årlig omkostning sammenligning
          </span>
          
          <div className={`flex items-center justify-between rounded-lg border p-4 ${isWorseOffer ? 'border-error-200 bg-error-50 dark:bg-error-900' : 'border-success-200 bg-success-50 dark:bg-success-900'}`}>
            <div className="flex items-center gap-3">
              <IconWithBackground
                variant={isWorseOffer ? "error" : "success"}
                size="medium"
              >
                <FeatherTrendingUp className="text-default-font" />
              </IconWithBackground>
              <div className="flex flex-col gap-1">
                <span className={`text-body-bold font-body-bold ${isWorseOffer ? 'text-error-700' : 'text-success-700'}`}>
                  {isWorseOffer ? 'Dyrere tilbud' : 'Årlig besparelse'}
                </span>
                <span className={`text-caption font-caption ${isWorseOffer ? 'text-error-600' : 'text-success-600'}`}>
                  {absoluteSavingsPercentage.toFixed(1)}% {isWorseOffer ? 'dyrere' : 'billigere'}
                </span>
              </div>
            </div>
            <span className={`text-heading-2 font-heading-2 ${isWorseOffer ? 'text-error-600' : 'text-success-600'}`}>
              {formatCurrency(absoluteSavings)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-body-bold font-body-bold text-default-font">
              Nuværende forsikring
            </span>
            <span className="text-heading-3 font-heading-3 text-default-font">
              {formatCurrency(currentPremium)}/år
            </span>
          </div>

          <div className="flex h-12 w-full rounded-lg bg-success-100 dark:bg-success-900 overflow-hidden">
            <div
              className={`flex h-12 items-center justify-between px-6 ${isWorseOffer ? 'bg-error-500' : 'bg-success-500'}`}
              style={{ width: `${barWidthPercentage}%` }}
            >
              <span className="text-body-bold font-body-bold text-white">
                Nyt tilbud
              </span>
              <span className="text-heading-3 font-heading-3 text-white">
                {formatCurrency(offerPremium)}/år
              </span>
            </div>
          </div>
        </div>

        {highlights.length > 0 && (
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Højdepunkter
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {highlights.map((highlight: any, index: number) => {
                const Icon = iconMap[highlight.icon] || FeatherCheck;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700">
                    <IconWithBackground
                      variant={highlight.variant || (isWorseOffer ? "error" : "success")}
                      size="medium"
                    >
                      <Icon className="text-default-font" />
                    </IconWithBackground>
                    <div className="flex flex-col gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {highlight.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {highlight.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {detailedComparison.length > 0 && (
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Detaljeret sammenligning
            </span>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-neutral-300 dark:border-neutral-600">
                    <th className="text-left p-3 text-caption-bold font-caption-bold text-subtext-color">Dækning</th>
                    <th className="text-center p-3 text-body-bold font-body-bold text-default-font">Nuværende</th>
                    <th className="text-center p-3 text-body-bold font-body-bold text-default-font">Nyt tilbud</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedComparison.map((category: any, catIndex: number) => (
                    category.rows && category.rows.map((row: any, rowIndex: number) => (
                      <tr key={`${catIndex}-${rowIndex}`} className="border-b border-neutral-border">
                        <td className="p-3 text-body-bold font-body-bold text-default-font">
                          {row.feature}
                          {row.description && (
                            <div className="text-caption font-caption text-subtext-color">{row.description}</div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.currentValue === 'inkluderet' || row.currentValue === true ? (
                            <Badge variant="success">inkluderet</Badge>
                          ) : row.currentValue === 'ikke inkluderet' || row.currentValue === false ? (
                            <Badge variant="neutral">ikke inkluderet</Badge>
                          ) : (
                            <span className="text-body font-body text-default-font">{row.currentValue}</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.offerValue === 'inkluderet' || row.offerValue === true ? (
                            <Badge variant="success">inkluderet</Badge>
                          ) : row.offerValue === 'ikke inkluderet' || row.offerValue === false ? (
                            <Badge variant="neutral">ikke inkluderet</Badge>
                          ) : (
                            <span className="text-body font-body text-default-font">{row.offerValue}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayoutWithNav userId={userId}>
      <div className="flex flex-col h-full w-full">
        <div className="border-b border-neutral-200 dark:border-neutral-700">
          <ListingsTabs
            tabs={tabs.map(tab => ({
              id: tab.id,
              text: tab.label,
              count: tab.count,
              icon: tab.Icon ? <tab.Icon className="text-subtext-color" /> : undefined,
              active: selectedTab === tab.id,
              onClick: () => setSelectedTab(tab.id)
            }))}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedTab === "samlet" && renderCombinedOverview()}
          {selectedTab !== "samlet" && renderPolicyTypeComparison(selectedTab)}
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
