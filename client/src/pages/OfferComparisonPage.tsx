import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Badge,
  Button,
  IconWithBackground,
  ListingsTabs,
  Table,
  AreaChart
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
  FeatherAlertCircle,
  FeatherArrowUp,
  FeatherPiggyBank
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
  const [location, setLocation] = useLocation();
  
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'samlet';
  };
  
  const [selectedTab, setSelectedTab] = useState<string>(getTabFromUrl());
  
  useEffect(() => {
    setSelectedTab(getTabFromUrl());
  }, [location]);

  const { data: comparisons, isLoading: comparisonsLoading } = useQuery<any[]>({
    queryKey: ['/api/sammenligning', userId, companyId],
    enabled: !!userId && !!companyId,
  });

  const { data: combinedData, isLoading: combinedLoading } = useQuery<any>({
    queryKey: ['/api/sammenligning', userId, companyId, 'combined'],
    enabled: !!userId && !!companyId,
  });

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
              {formatCurrency(combinedData.totalSavings * 10)} over 10 år
            </Badge>
          </div>
          <AreaChart
            className="mobile:h-64 mobile:flex-none"
            categories={["Besparelse"]}
            data={[
              { Year: "År 1", Besparelse: combinedData.totalSavings },
              { Year: "År 2", Besparelse: combinedData.totalSavings * 2 },
              { Year: "År 3", Besparelse: combinedData.totalSavings * 3 },
              { Year: "År 4", Besparelse: combinedData.totalSavings * 4 },
              { Year: "År 5", Besparelse: combinedData.totalSavings * 5 },
              { Year: "År 6", Besparelse: combinedData.totalSavings * 6 },
              { Year: "År 7", Besparelse: combinedData.totalSavings * 7 },
              { Year: "År 8", Besparelse: combinedData.totalSavings * 8 },
              { Year: "År 9", Besparelse: combinedData.totalSavings * 9 },
              { Year: "År 10", Besparelse: combinedData.totalSavings * 10 },
            ]}
            index={"Year"}
          />
          <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-row mobile:flex-wrap mobile:gap-3">
            <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
              <span className="text-caption font-caption text-subtext-color">
                Månedlig besparelse
              </span>
              <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                {formatCurrency(Math.round(combinedData.totalSavings / 12))}
              </span>
            </div>
            <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
              <span className="text-caption font-caption text-subtext-color">
                Total efter 12 måneder
              </span>
              <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                {formatCurrency(combinedData.totalSavings)} spart
              </span>
            </div>
            <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
              <span className="text-caption font-caption text-subtext-color">
                Forventet efter 10 år
              </span>
              <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                {formatCurrency(combinedData.totalSavings * 10)} spart
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
            <div className="overflow-x-auto bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell className="text-left">Type</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Nuværende</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Tilbud</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Besparelse</Table.HeaderCell>
                    <Table.HeaderCell className="text-center">Status</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {combinedData.quickComparison.map((row: any, index: number) => (
                  <Table.Row key={index}>
                    <Table.Cell>
                      <span className="text-body-bold font-body-bold text-default-font">
                        {policyTypeLabels[row.policyType] || row.policyType}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="justify-end">
                      <span className="text-body font-body text-subtext-color">
                        {formatCurrency(row.currentPremium)}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="justify-end">
                      <span className="text-body font-body text-subtext-color">
                        {formatCurrency(row.offerPremium)}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="justify-end">
                      <span className="text-body-bold font-body-bold text-brand-600">
                        {formatCurrency(row.savings)}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="justify-center">
                      <Badge variant={verdictColors[row.verdict] as any}>
                        {verdictLabels[row.verdict]}
                      </Badge>
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
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell className="text-left">Dækning</Table.HeaderCell>
                    <Table.HeaderCell className="text-center">Nuværende</Table.HeaderCell>
                    <Table.HeaderCell className="text-center">Nyt tilbud</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {detailedComparison.map((category: any, catIndex: number) => (
                  category.rows && category.rows.map((row: any, rowIndex: number) => (
                    <Table.Row key={`${catIndex}-${rowIndex}`}>
                      <Table.Cell>
                        <div className="flex flex-col gap-1">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {row.feature}
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
                          <Badge variant="neutral">ikke inkluderet</Badge>
                        ) : (
                          <span className="text-body font-body text-default-font">{row.currentValue}</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="justify-center">
                        {row.offerValue === 'inkluderet' || row.offerValue === true ? (
                          <Badge variant="success">inkluderet</Badge>
                        ) : row.offerValue === 'ikke inkluderet' || row.offerValue === false ? (
                          <Badge variant="neutral">ikke inkluderet</Badge>
                        ) : (
                          <span className="text-body font-body text-default-font">{row.offerValue}</span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))
                ))}
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleTabChange = (tabId: string) => {
    const newUrl = `/sammenligning/${userId}/${companyId}?tab=${tabId}`;
    setLocation(newUrl);
  };

  return (
    <AppLayoutWithNav userId={userId}>
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
