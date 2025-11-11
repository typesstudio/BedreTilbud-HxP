import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { 
  Badge, 
  Button, 
  IconWithBackground, 
  ListingsTabs,
  AreaChart
} from "@/ui";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { getVariantBackgroundClass } from "@/lib/variantColors";
import { 
  FeatherHome,
  FeatherShield,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
  FeatherTrendingUp,
  FeatherTrendingDown,
  FeatherTruck,
  FeatherDroplet,
  FeatherAlertCircle,
  FeatherCheck,
  FeatherCheckCircle,
  FeatherDollarSign,
  FeatherHelpCircle,
  FeatherClock,
  FeatherPiggyBank,
  FeatherSquare,
  FeatherArrowRight,
  FeatherArrowUp,
  FeatherSend,
  FeatherZap,
  FeatherStar,
  FeatherHeadphones
} from "@subframe/core";
import type { Policy } from "@shared/schema";

const iconMap: { [key: string]: any } = {
  "trending-up": FeatherTrendingUp,
  "trending-down": FeatherTrendingDown,
  "truck": FeatherTruck,
  "droplet": FeatherDroplet,
  "shield": FeatherShield,
  "home": FeatherHome,
  "clock": FeatherClock,
  "piggy-bank": FeatherPiggyBank,
  "dollar-sign": FeatherDollarSign,
  "help-circle": FeatherHelpCircle,
  "alert-circle": FeatherAlertCircle,
  "check": FeatherCheck,
  "check-circle": FeatherCheckCircle,
  "building": FeatherBuilding,
  "car": FeatherCar,
  "plane": FeatherPlane,
  "zap": FeatherZap,
  "star": FeatherStar,
  "headphones": FeatherHeadphones
};

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

interface PolicyGroup {
  indbo: Policy[];
  ulykke: Policy[];
  hus: Policy[];
  bil: Policy[];
  rejse: Policy[];
  other: Policy[];
}

export default function InsuranceCheckPage() {
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-default-background">
        <div className="flex flex-col items-center gap-4">
          <span className="text-heading-2 font-heading-2 text-default-font">Bruger ikke fundet</span>
          <span className="text-body font-body text-subtext-color">Gå tilbage til forsiden</span>
        </div>
      </div>
    );
  }

  // Set localStorage userId from URL param SYNCHRONOUSLY before queries run
  // This ensures the X-User-ID header is present on first fetch
  if (userId && localStorage.getItem('userId') !== userId) {
    localStorage.setItem('userId', userId);
  }
  
  const { data: policiesData, isLoading, isError, refetch } = useQuery<PolicyGroup>({
    queryKey: ['/api/policies', 'user', userId],
  });

  const availableTypes = ['indbo', 'ulykke', 'hus', 'bil', 'rejse'].filter(
    type => policiesData && policiesData[type as keyof PolicyGroup]?.length > 0
  );

  const [selectedType, setSelectedType] = useState<string>('indbo');

  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(selectedType)) {
      setSelectedType(availableTypes[0]);
    }
  }, [availableTypes, selectedType]);

  const selectedPolicies = policiesData?.[selectedType as keyof PolicyGroup] || [];
  const selectedPolicy = selectedPolicies[0];

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "N/A";
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' kr';
  };

  if (isLoading) {
    return (
      <AppLayoutWithNav userId={userId}>
        <div className="flex items-center justify-center min-h-screen bg-default-background">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayoutWithNav>
    );
  }

  if (isError) {
    return (
      <AppLayoutWithNav userId={userId}>
        <div className="flex items-center justify-center min-h-screen bg-default-background">
          <div className="flex flex-col items-center gap-4">
            <span className="text-heading-2 font-heading-2 text-default-font">Der opstod en fejl</span>
            <span className="text-body font-body text-subtext-color text-center">
              Kunne ikke hente dine forsikringer. Prøv venligst igen.
            </span>
            <Button onClick={() => refetch()} data-testid="button-retry">
              Prøv igen
            </Button>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  const healthCheckPayload = selectedPolicy?.healthCheckPayload as any;

  return (
    <AppLayoutWithNav userId={userId}>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-6 py-6">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6">
          
          {/* Header */}
          <div className="flex w-full items-start gap-2 px-2 py-2">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 px-2 py-2">
              <span className="text-heading-1 font-heading-1 text-default-font">
                Dit forsikringstjek
              </span>
              <span className="text-body font-body text-subtext-color">
                Se en grundig analyse af dine forsikringer, og potentielle besparelser
              </span>
            </div>
            <Button
              onClick={() => {}}
              data-testid="button-get-better-offer"
            >
              Få bedre tilbud
            </Button>
          </div>

          {/* ListingsTabs Navigation - Only show tabs for insurance types with data */}
          <div className="flex w-full flex-col items-start gap-2 border-b border-solid border-neutral-border bg-default-background sticky top-0 z-20">
            <div className="flex w-full items-center gap-2 overflow-x-auto">
              <ListingsTabs>
                {(['indbo', 'ulykke', 'hus', 'bil', 'rejse'] as const)
                  .filter((type) => (policiesData?.[type]?.length ?? 0) > 0)
                  .map((type) => {
                    const IconComponent = policyTypeIcons[type];
                    
                    return (
                      <ListingsTabs.Item
                        key={type}
                        checked={selectedType === type}
                        icon={<IconComponent />}
                        onClick={() => setSelectedType(type)}
                        data-testid={`tab-${type}`}
                      >
                        {policyTypeLabels[type]}
                      </ListingsTabs.Item>
                    );
                  })}
              </ListingsTabs>
            </div>
          </div>

          {/* Empty State */}
          {selectedPolicies.length === 0 && (() => {
            const EmptyIcon = policyTypeIcons[selectedType] || FeatherShield;
            return (
              <div className="flex w-full flex-col items-center gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-12">
                <IconWithBackground
                  variant="neutral"
                  size="large"
                  icon={<EmptyIcon />}
                />
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Du har ingen {policyTypeLabels[selectedType].toLowerCase()} uploadet
                  </span>
                  <span className="text-body font-body text-subtext-color">
                    Gå til din profil og upload dine forsikringer for at få et detaljeret tjek
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Health Check Results */}
          {selectedPolicy && healthCheckPayload && (
            <>
              {/* 1. ÅRLIG POTENTIEL BESPARELSE */}
              {healthCheckPayload.potentialSavings && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <span className="text-heading-2 font-heading-2 text-default-font">
                    Årlig potentiel besparelse
                  </span>
                  <div className="flex w-full items-center justify-between rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4">
                    <span className="text-heading-1 font-heading-1 text-success-600">
                      {formatCurrency(healthCheckPayload.potentialSavings.realistic)} kr
                    </span>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-success-700">
                        {healthCheckPayload.potentialSavings.explanation}
                      </span>
                      {selectedPolicy.annualPremium && healthCheckPayload.potentialSavings.realistic && (
                        <span className="text-caption font-caption text-success-600">
                          {Math.round((healthCheckPayload.potentialSavings.realistic / selectedPolicy.annualPremium) * 100)}% lavere omkostning
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. DINE FORSIKRINGSFORDELE */}
              {healthCheckPayload.policyBenefits && healthCheckPayload.policyBenefits.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Dine forsikringsfordele
                  </span>
                  <div className="flex w-full items-start gap-4">
                    {healthCheckPayload.policyBenefits.map((benefit: any, index: number) => {
                      const IconComponent = iconMap[benefit.icon] || FeatherShield;
                      return (
                        <div
                          key={index}
                          className="flex grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                          data-testid={`benefit-${index}`}
                        >
                          <IconWithBackground
                            size="medium"
                            icon={<IconComponent />}
                            square={true}
                          />
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-body-bold font-body-bold text-default-font">
                              {benefit.title}
                            </span>
                            <span className="text-caption font-caption text-subtext-color">
                              {benefit.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. HVAD ER INKLUDERET */}
              {healthCheckPayload.whatsIncluded && healthCheckPayload.whatsIncluded.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Hvad er inkluderet
                  </span>
                  <div className="flex w-full flex-col items-start overflow-x-auto">
                    <div className="flex w-full min-w-[576px] items-center gap-4 border-b-2 border-solid border-neutral-300 bg-neutral-50 pb-3 sticky top-0 z-10">
                      <div className="flex w-48 flex-none flex-col items-start">
                        <span className="text-caption-bold font-caption-bold text-subtext-color">
                          Dækning
                        </span>
                      </div>
                      <div className="flex grow shrink-0 basis-0 flex-col items-center">
                        <span className="text-body-bold font-body-bold text-default-font">
                          Status
                        </span>
                      </div>
                    </div>
                    <div className="flex w-full min-w-[576px] flex-col items-start">
                      {healthCheckPayload.whatsIncluded.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="flex w-full items-center gap-4 border-b border-solid border-neutral-border py-4"
                          data-testid={`coverage-${index}`}
                        >
                          <div className="flex w-48 flex-none flex-col items-start gap-1">
                            <span className="text-body-bold font-body-bold text-default-font">
                              {item.coverage}
                            </span>
                            <span className="text-caption font-caption text-subtext-color">
                              {item.description}
                            </span>
                          </div>
                          <div className="flex grow shrink-0 basis-0 items-center justify-center">
                            <Badge variant={item.status === 'success' ? 'success' : 'neutral'}>
                              {item.value}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. DIN FORSIKRINGSOVERSIGT */}
              {healthCheckPayload.policyOverview && healthCheckPayload.policyOverview.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Din forsikringsoversigt
                  </span>
                  <div className="flex w-full items-start gap-4 flex-wrap">
                    {healthCheckPayload.policyOverview.map((item: any, index: number) => {
                      const IconComponent = iconMap[item.icon] || FeatherHome;
                      return (
                        <div
                          key={index}
                          className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-center gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                          data-testid={`overview-${index}`}
                        >
                          <IconWithBackground
                            size="medium"
                            icon={<IconComponent />}
                          />
                          <div className="flex w-full flex-col items-center gap-1">
                            <span className="text-caption font-caption text-subtext-color">
                              {item.label}
                            </span>
                            <span className="text-heading-1 font-heading-1 text-default-font">
                              {item.value}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. MANGLENDE INFORMATION */}
              {healthCheckPayload.missingInformation && healthCheckPayload.missingInformation.categories && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
                  <div className="flex w-full flex-col items-start gap-2">
                    <div className="flex w-full items-center justify-between">
                      <span className="text-heading-3 font-heading-3 text-default-font">
                        Manglende information
                      </span>
                      <Badge variant="warning">
                        {healthCheckPayload.missingInformation.totalIssues} punkter
                      </Badge>
                    </div>
                    <span className="text-body font-body text-subtext-color">
                      Vi har fundet punkter der mangler tydelig dokumentation
                    </span>
                  </div>
                  <div className="flex w-full flex-col items-start gap-4">
                    {healthCheckPayload.missingInformation.categories.map((category: any, catIndex: number) => {
                      const IconComponent = iconMap[category?.icon] || FeatherHelpCircle;
                      return (
                        <div key={catIndex} className="flex w-full flex-col items-start gap-3">
                          <div className="flex w-full items-center gap-2">
                            <IconWithBackground
                              variant={category.criticalCount > 0 ? "error" : category.importantCount > 0 ? "warning" : "neutral"}
                              size="small"
                              icon={<IconComponent />}
                            />
                            <span className="text-body-bold font-body-bold text-default-font">
                              {category.name}
                            </span>
                            {category.criticalCount > 0 && (
                              <Badge variant="error">{category.criticalCount} Kritiske</Badge>
                            )}
                            {category.importantCount > 0 && (
                              <Badge variant="warning">{category.importantCount} Vigtige</Badge>
                            )}
                            {category.questionsCount > 0 && (
                              <Badge variant="neutral">{category.questionsCount} Spørgsmål</Badge>
                            )}
                          </div>
                          {category.items.map((item: any, itemIndex: number) => (
                            <div
                              key={itemIndex}
                              className={`flex w-full items-start gap-3 rounded-md border ${
                                item.severity === 'critical'
                                  ? 'border-2 border-solid border-error-600 bg-error-50'
                                  : item.severity === 'important'
                                  ? 'border border-solid border-warning-200 bg-warning-50'
                                  : 'border border-solid border-neutral-border bg-neutral-50'
                              } px-4 py-4`}
                              data-testid={`missing-info-${catIndex}-${itemIndex}`}
                            >
                              <FeatherSquare
                                className={`text-body font-body mt-0.5 ${
                                  item.severity === 'critical'
                                    ? 'text-error-600'
                                    : item.severity === 'important'
                                    ? 'text-warning-600'
                                    : 'text-neutral-400'
                                }`}
                              />
                              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                                <div className="flex w-full flex-col items-start gap-1 px-2 py-2">
                                  <span className="text-body-bold font-body-bold text-default-font">
                                    {item.title}
                                  </span>
                                  {item.description && (
                                    <span className="text-caption font-caption text-subtext-color">
                                      {item.description}
                                    </span>
                                  )}
                                </div>
                                {item.response && (
                                  <div className="flex w-full flex-col items-start gap-1 rounded-md border border-solid border-success-300 bg-white px-3 py-2">
                                    <span className="text-caption-bold font-caption-bold text-success-700">
                                      Svar fra selskabet
                                    </span>
                                    <span className="text-body font-body text-default-font">
                                      {item.response}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {catIndex < healthCheckPayload.missingInformation.categories.length - 1 && (
                            <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {healthCheckPayload.missingInformation.criticalCount > 0 && (
                    <div className="flex w-full items-center gap-2 rounded-md bg-error-50 px-4 py-3">
                      <FeatherAlertCircle className="text-body font-body text-error-600" />
                      <span className="text-caption font-caption text-error-700">
                        {healthCheckPayload.missingInformation.criticalCount} kritiske punkter kræver øjeblikkelig afklaring
                      </span>
                    </div>
                  )}
                  <Button
                    className="h-10 w-full flex-none"
                    size="large"
                    icon={<FeatherSend />}
                    onClick={() => {}}
                    data-testid="button-send-to-company"
                  >
                    Send til selskabet (0 valgt)
                  </Button>
                </div>
              )}

              {/* 6. KUMULATIV BESPARELSE */}
              {healthCheckPayload.cumulativeSavings && (
                <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex flex-col items-start gap-2">
                      <span className="text-heading-2 font-heading-2 text-default-font">
                        Kumulativ besparelse
                      </span>
                      <span className="text-body font-body text-subtext-color">
                        Se hvor meget du sparer måned for måned
                      </span>
                    </div>
                    <Badge variant="success" icon={<FeatherArrowUp />}>
                      {formatCurrency(healthCheckPayload.cumulativeSavings.totalOver10Years)} over 10 år
                    </Badge>
                  </div>
                  {healthCheckPayload.cumulativeSavings.chartData && (
                    <AreaChart
                      categories={["savings"]}
                      data={healthCheckPayload.cumulativeSavings.chartData.map((d: any) => ({
                        month: d.month,
                        savings: d.savings
                      }))}
                      index="month"
                    />
                  )}
                  <div className="flex w-full items-start gap-4 flex-wrap">
                    {healthCheckPayload.cumulativeSavings.monthlyRange && (
                      <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
                        <span className="text-caption font-caption text-subtext-color">
                          Månedlig besparelse
                        </span>
                        <span className="text-heading-2 font-heading-2 text-success-600">
                          {healthCheckPayload.cumulativeSavings.monthlyRange.min}-
                          {healthCheckPayload.cumulativeSavings.monthlyRange.max} kr
                        </span>
                      </div>
                    )}
                    {healthCheckPayload.cumulativeSavings.after12Months && (
                      <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
                        <span className="text-caption font-caption text-subtext-color">
                          Total efter 12 måneder
                        </span>
                        <span className="text-heading-2 font-heading-2 text-success-600">
                          {formatCurrency(healthCheckPayload.cumulativeSavings.after12Months)} spart
                        </span>
                      </div>
                    )}
                    {healthCheckPayload.cumulativeSavings.after10Years && (
                      <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
                        <span className="text-caption font-caption text-subtext-color">
                          Forventet efter 10 år
                        </span>
                        <span className="text-heading-2 font-heading-2 text-success-600">
                          {formatCurrency(healthCheckPayload.cumulativeSavings.after10Years)} spart
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex w-full items-center gap-2 rounded-md bg-success-50 px-4 py-3">
                    <FeatherPiggyBank className="text-body font-body text-success-700" />
                    <span className="text-body font-body text-default-font">
                      Vi låser ind når priserne dykker og maksimerer din besparelse
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
