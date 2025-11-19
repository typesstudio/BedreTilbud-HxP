import { useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import {
  Badge,
  Button,
  IconWithBackground,
  ListingsTabs,
  Table,
  AreaChart
} from "@/ui";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { AnnualSavingsCard } from "@/components/AnnualSavingsCard";
import { getVariantBackgroundClass } from "@/lib/variantColors";
import {
  FeatherHome,
  FeatherShield,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
  FeatherTrendingUp,
  FeatherTrendingDown,
  FeatherCheck,
  FeatherAlertCircle,
  FeatherArrowUp,
  FeatherPiggyBank,
  FeatherStar
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
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const userId = localStorage.getItem("userId");
  
  const selectedTab = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('tab') || 'samlet';
  }, [searchString]);

  // NEW: Fetch from company_comparisons endpoint
  const { data: comparisonResponse, isLoading } = useQuery<any>({
    queryKey: ['/api/company-comparisons', id],
    enabled: !!id,
  });

  const comparisonData = comparisonResponse?.comparisonData || {};
  const policyComparisons = comparisonData.policyComparisons || [];
  const overall = comparisonData.overall || {};

  const multiPolicyProjection = useMemo(() => {
    const cumulativeSavings = comparisonData.cumulativeSavings;
    if (!cumulativeSavings || !cumulativeSavings.chartData || cumulativeSavings.chartData.length === 0) {
      return { data: [], categories: [] };
    }
    
    const chartData = cumulativeSavings.chartData.map((item: any, index: number) => {
      const yearMilestone = (index + 1) % 12 === 0 ? ` (År ${(index + 1) / 12})` : '';
      return {
        Måned: `${item.month || index + 1}${yearMilestone}`,
        Besparelse: Math.round(item.savings || 0)
      };
    });
    
    return { 
      data: chartData, 
      categories: ["Besparelse"] 
    };
  }, [comparisonData]);

  if (!id) {
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

  if (isLoading) {
    return (
      <AppLayoutWithNav userId={userId || undefined}>
        <div className="flex items-center justify-center min-h-screen">
          <span className="text-body font-body text-subtext-color">Indlæser sammenligning...</span>
        </div>
      </AppLayoutWithNav>
    );
  }

  if (!policyComparisons || policyComparisons.length === 0) {
    return (
      <AppLayoutWithNav userId={userId || undefined}>
        <div className="flex items-center justify-center min-h-screen">
          <span className="text-body font-body text-default-font">Ingen sammenligninger fundet</span>
        </div>
      </AppLayoutWithNav>
    );
  }

  const currentCompanyName = comparisonResponse?.currentCompanyName || "Nuværende forsikring";
  const offerCompanyName = comparisonResponse?.offerCompanyName || "Nyt tilbud";
  const availablePolicyTypes = policyComparisons 
    ? Array.from(new Set(policyComparisons.map((c: any) => c.policyType).filter(Boolean))) 
    : [];

  const tabs = [
    {
      id: "samlet",
      label: "Samlet oversigt",
      count: availablePolicyTypes.length,
      Icon: FeatherStar
    },
    ...availablePolicyTypes.map((type) => ({
      id: String(type),
      label: policyTypeLabels[String(type)] || String(type),
      count: undefined,
      Icon: policyTypeIcons[String(type)]
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
    if (!overall) return null;

    const annualSavings = overall.annualSavings || 0;
    const savingsPercent = overall.annualSavingsPercent || 0;
    const totalOver10Years = comparisonData.cumulativeSavings?.totalOver10Years || (annualSavings * 10);

    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-heading-2 font-heading-2 text-default-font">
              {offerCompanyName}
            </span>
            <Badge variant={annualSavings >= 0 ? "success" : "error"}>
              {annualSavings >= 0 ? "Billigere" : "Dyrere"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <span className="text-body-bold font-body-bold text-subtext-color">Samlet besparelse</span>
              <span className="text-heading-1 font-heading-1 text-brand-600">
                {formatCurrency(annualSavings)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                {savingsPercent.toFixed(1)}% billigere
              </span>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <span className="text-body-bold font-body-bold text-subtext-color">Antal forsikringer</span>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {policyComparisons.length}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Sammenlignede typer
              </span>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <span className="text-body-bold font-body-bold text-subtext-color">Nuværende pris</span>
              <span className="text-heading-3 font-heading-3 text-default-font">
                {formatCurrency(overall.totalCurrentAnnualPremium)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Per år
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center justify-between mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2">
            <div className="flex flex-col items-start gap-2">
              <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
                Kumulativ besparelse
              </span>
              <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                Se hvor meget du sparer måned for måned
              </span>
            </div>
            <Badge
              className="mobile:self-start"
              variant="success"
              icon={<FeatherArrowUp />}
            >
              {formatCurrency(totalOver10Years)} over 10 år
            </Badge>
          </div>
          <AreaChart
            className="mobile:h-64 mobile:flex-none"
            categories={multiPolicyProjection.categories.length > 0 ? multiPolicyProjection.categories : ["Besparelse"]}
            data={multiPolicyProjection.data.length > 0 ? multiPolicyProjection.data : [
              { Måned: "1", "Besparelse": 0 }
            ]}
            index={"Måned"}
          />
          <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-row mobile:flex-wrap mobile:gap-3">
            <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
              <span className="text-caption font-caption text-subtext-color">
                Månedlig besparelse
              </span>
              <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                {formatCurrency(Math.round(annualSavings / 12))}
              </span>
            </div>
            <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
              <span className="text-caption font-caption text-subtext-color">
                Total efter 12 måneder
              </span>
              <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                {formatCurrency(annualSavings)} spart
              </span>
            </div>
            <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
              <span className="text-caption font-caption text-subtext-color">
                Forventet efter 10 år
              </span>
              <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                {formatCurrency(totalOver10Years)} spart
              </span>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 rounded-md bg-success-50 px-4 py-3 mobile:items-start mobile:justify-start">
            <FeatherPiggyBank className="text-body font-body text-success-700 mobile:mt-0.5" />
            <span className="text-body font-body text-default-font mobile:text-caption mobile:font-caption">
              Vi låser ind når priserne dykker og maksimerer din besparelse
            </span>
          </div>
        </div>

        {overall.globalHighlights && overall.globalHighlights.length > 0 && (
          <div className="flex flex-col gap-4">
            <span className="text-heading-3 font-heading-3 text-default-font">Højdepunkter</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {overall.globalHighlights.map((highlight: any, index: number) => {
                const bgClass = getVariantBackgroundClass(highlight.variant || "neutral");
                return (
                  <div 
                    key={index} 
                    className={`flex flex-col gap-2 p-4 rounded-lg border ${bgClass}`}
                    data-testid={`highlight-card-${index}`}
                  >
                    <span className="text-body-bold font-body-bold text-default-font">
                      {highlight.title}
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      {highlight.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {overall.perPolicySummary && overall.perPolicySummary.length > 0 && (
          <div className="flex flex-col gap-4">
            <span className="text-heading-3 font-heading-3 text-default-font">Hurtig oversigt</span>
            <div className="overflow-x-auto bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell className="text-left">Type</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Nuværende</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Tilbud</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Besparelse</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {overall.perPolicySummary.map((row: any, index: number) => (
                  <Table.Row key={index}>
                    <Table.Cell>
                      <span className="text-body-bold font-body-bold text-default-font">
                        {row.label || policyTypeLabels[row.policyType] || row.policyType}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="justify-end">
                      <span className="text-body font-body text-subtext-color">
                        {formatCurrency(row.currentAnnualPremium)}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="justify-end">
                      <span className="text-body font-body text-subtext-color">
                        {formatCurrency(row.offerAnnualPremium)}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="justify-end">
                      <span className="text-body-bold font-body-bold text-brand-600">
                        {formatCurrency(row.savings)}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPolicyTypeComparison = (policyType: string) => {
    if (!policyComparisons) return null;
    const comparison = policyComparisons.find((c: any) => c.policyType === policyType);
    if (!comparison) return null;

    const costSummary = comparison.costSummary || {};
    const currentPremium = costSummary.currentAnnualPremium || 0;
    const offerPremium = costSummary.offerAnnualPremium || 0;
    const savings = costSummary.savings || 0;
    const savingsPercentage = costSummary.savingsPercent || 0;
    const highlights = comparison.highlights || [];
    const coverageRows = comparison.coverageComparison?.rows || [];

    const isWorseOffer = savings < 0;

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

        <AnnualSavingsCard
          annualSavings={savings}
          savingsPercentage={savingsPercentage}
          currentPremium={currentPremium}
          offerPremium={offerPremium}
          variant={isWorseOffer ? "error" : "success"}
        />

        {highlights.length > 0 && (
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Højdepunkter
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {highlights.map((highlight: any, index: number) => {
                const variant = highlight.variant || (isWorseOffer ? "error" : "success");
                const bgClass = getVariantBackgroundClass(variant);
                return (
                  <div 
                    key={index} 
                    className={`flex flex-col gap-2 p-4 rounded-md border ${bgClass}`}
                    data-testid={`highlight-card-${index}`}
                  >
                    <span className="text-body-bold font-body-bold text-default-font">
                      {highlight.title}
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      {highlight.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {coverageRows.length > 0 && (
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Detaljeret sammenligning
            </span>
            <div className="overflow-x-auto">
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell className="text-left">Dækning</Table.HeaderCell>
                    <Table.HeaderCell className="text-center">Nuværende</Table.HeaderCell>
                    <Table.HeaderCell className="text-center">Nyt tilbud</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {coverageRows.map((row: any, rowIndex: number) => (
                  <Table.Row key={rowIndex}>
                    <Table.Cell>
                      <div className="flex flex-col gap-1">
                        <span className="text-body font-body text-default-font">
                          {row.feature || row.label}
                        </span>
                        {row.description && (
                          <span className="text-caption font-caption text-subtext-color">
                            {row.description}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="justify-center">
                      {row.currentValue === 'inkluderet' || row.currentValue === true ? (
                        <Badge variant="success">inkluderet</Badge>
                      ) : row.currentValue === 'ikke inkluderet' || row.currentValue === false ? (
                        <Badge variant="error">ikke inkluderet</Badge>
                      ) : (
                        <span className="text-body font-body text-default-font">{row.currentValue || "N/A"}</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="justify-center">
                      {row.offerValue === 'inkluderet' || row.offerValue === true ? (
                        <Badge variant="success">inkluderet</Badge>
                      ) : row.offerValue === 'ikke inkluderet' || row.offerValue === false ? (
                        <Badge variant="error">ikke inkluderet</Badge>
                      ) : (
                        <span className="text-body font-body text-default-font">{row.offerValue || "N/A"}</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleTabChange = (tabId: string) => {
    if (!id) return;
    const newUrl = `/sammenligning/${id}?tab=${tabId}`;
    setLocation(newUrl);
  };

  return (
    <AppLayoutWithNav userId={userId || undefined}>
      <div className="flex flex-col h-full w-full">
        <div className="border-b border-neutral-200 dark:border-neutral-700 px-6">
          <ListingsTabs>
            {tabs.map(tab => {
              const IconComponent = tab.Icon;
              return (
                <ListingsTabs.Item
                  key={tab.id}
                  checked={selectedTab === tab.id}
                  icon={IconComponent ? <IconComponent /> : undefined}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </ListingsTabs.Item>
              );
            })}
          </ListingsTabs>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedTab === "samlet" && renderCombinedOverview()}
          {selectedTab !== "samlet" && renderPolicyTypeComparison(selectedTab)}
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
