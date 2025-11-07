import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Badge, 
  Button, 
  IconWithBackground, 
  Table,
  ListingsTabs
} from "@/ui";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MobileComparisonCard } from "@/components/mobile-comparison-card";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { 
  FeatherHome,
  FeatherShield,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
  FeatherRefreshCw,
  FeatherTrendingUp,
  FeatherTrendingDown,
  FeatherTruck,
  FeatherDroplet,
  FeatherAlertCircle,
  FeatherCheck,
  FeatherDollarSign,
  FeatherHelpCircle,
  FeatherClock,
  FeatherPiggyBank,
  FeatherInfo
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
  "info": FeatherInfo,
  "building": FeatherBuilding,
  "car": FeatherCar,
  "plane": FeatherPlane
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

interface InsuranceCheckPageProps {
  params: { userId: string };
}

export default function InsuranceCheckPage({ params }: InsuranceCheckPageProps) {
  const { userId } = params;
  const { toast } = useToast();
  
  const { data: policiesData, isLoading } = useQuery<PolicyGroup>({
    queryKey: ['/api/policies', 'user', userId],
  });

  const availableTypes = ['indbo', 'ulykke', 'hus', 'bil', 'rejse'].filter(
    type => policiesData && policiesData[type as keyof PolicyGroup]?.length > 0
  );

  const [selectedType, setSelectedType] = useState<string>(availableTypes[0] || 'indbo');

  const selectedPolicies = policiesData?.[selectedType as keyof PolicyGroup] || [];
  const selectedPolicy = selectedPolicies[0];

  const refreshMutation = useMutation({
    mutationFn: async (policyId: string) => {
      const response = await apiRequest("POST", `/api/policies/${policyId}/refresh`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policies', 'user', userId] });
      toast({
        title: "Genindlæst",
        description: "Forsikringstjek er opdateret",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke genindlæse forsikringstjek",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "N/A";
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' kr';
  };

  const calculatePercentage = (savings: number | null | undefined, premium: number | null | undefined) => {
    if (savings == null || premium == null || premium === 0) return null;
    return ((savings / premium) * 100).toFixed(1);
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

  const healthCheckPayload = selectedPolicy?.healthCheckPayload as any;
  const healthCheckSavingsAnnual = selectedPolicy?.healthCheckSavingsAnnual;
  const premium = selectedPolicy?.premium;
  const savingsPercentage = calculatePercentage(healthCheckSavingsAnnual, premium);

  return (
    <AppLayoutWithNav userId={userId}>
      <div className="flex w-full flex-col items-center bg-default-background px-6 py-6 mobile:px-4 mobile:py-4">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:gap-4">
          
          {/* Header */}
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-1 font-heading-1 text-default-font mobile:text-heading-2 mobile:font-heading-2">
                Dit forsikringstjek
              </span>
              <span className="text-body font-body text-subtext-color">
                Se en grundig analyse af dine forsikringer, og potentielle besparelser
              </span>
            </div>
            <Button
              variant="brand-primary"
              size="medium"
              className="h-12 mobile:w-full"
              data-testid="button-get-better-offer"
            >
              Få bedre tilbud
            </Button>
          </div>

          {/* ListingsTabs for policy types */}
          <div className="flex w-full flex-col items-start gap-2 border-b border-solid border-neutral-border bg-default-background sticky top-0 z-20">
            <div className="flex w-full items-center gap-2 overflow-x-auto">
              <ListingsTabs>
                {(['indbo', 'ulykke', 'hus', 'bil', 'rejse'] as const).map((type) => {
                  const IconComponent = policyTypeIcons[type];
                  const hasData = policiesData?.[type]?.length > 0;
                  
                  return (
                    <ListingsTabs.Item
                      key={type}
                      checked={selectedType === type}
                      icon={<IconComponent />}
                      onClick={() => setSelectedType(type)}
                      data-testid={`tab-${type}`}
                      className={!hasData ? 'opacity-50' : ''}
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
              <div className="flex w-full flex-col items-center gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-12 mobile:px-4 mobile:py-8">
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
          {selectedPolicy && (
            <>
              {/* Annual Savings Card */}
              {healthCheckSavingsAnnual != null && healthCheckSavingsAnnual > 0 && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:px-4 mobile:py-4">
                  <span className="text-heading-2 font-heading-2 text-default-font">
                    Årlig potentiel besparelse
                  </span>
                  <div className="flex w-full items-center justify-between rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4 mobile:px-4 mobile:py-3">
                    <span className="text-heading-1 font-heading-1 text-success-600 mobile:text-heading-2 mobile:font-heading-2">
                      {formatCurrency(healthCheckSavingsAnnual)}
                    </span>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-success-700">
                        Din årlige besparelse
                      </span>
                      {savingsPercentage && (
                        <span className="text-caption font-caption text-success-600">
                          {savingsPercentage}% lavere omkostning
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Strengths Cards */}
              {healthCheckPayload?.strengths && healthCheckPayload.strengths.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:px-4 mobile:py-4">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Højdepunkter hvor anbefalingen er bedre
                  </span>
                  <div className="flex w-full items-start gap-4 mobile:flex-col">
                    {healthCheckPayload.strengths.slice(0, 4).map((strength: any, index: number) => {
                      const IconComponent = iconMap[strength.icon] || FeatherCheck;
                      const shouldBeSuccess = index < 2;
                      return (
                        <div
                          key={index}
                          className="flex grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4 mobile:w-full"
                          data-testid={`strength-${index}`}
                        >
                          <IconWithBackground
                            variant={shouldBeSuccess ? "success" : "neutral"}
                            size="medium"
                            icon={<IconComponent />}
                            square={true}
                          />
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-body-bold font-body-bold text-default-font">
                              {strength.title}
                            </span>
                            <span className="text-caption font-caption text-subtext-color">
                              {strength.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Weaknesses Cards */}
              {healthCheckPayload?.weaknesses && healthCheckPayload.weaknesses.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4">
                  <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
                    Områder der kan forbedres
                  </span>
                  <div className="flex w-full flex-wrap items-start gap-4">
                    {healthCheckPayload.weaknesses.map((weakness: any, index: number) => {
                      const IconComponent = iconMap[weakness.icon] || FeatherAlertCircle;
                      const variantColor = weakness.severity === 'critical' ? 'error' : 'warning';
                      return (
                        <div
                          key={index}
                          className={`flex min-w-[280px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-lg border border-solid ${weakness.severity === 'critical' ? 'border-error-200 bg-error-50' : 'border-warning-200 bg-warning-50'} px-4 py-4 mobile:min-w-full`}
                          data-testid={`weakness-${index}`}
                        >
                          <IconWithBackground
                            variant={variantColor as any}
                            size="medium"
                            icon={<IconComponent />}
                            square={true}
                          />
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-body-bold font-body-bold text-default-font">
                              {weakness.title}
                            </span>
                            <span className="text-caption font-caption text-subtext-color">
                              {weakness.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comparison Table */}
              {healthCheckPayload?.comparisonData && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6 mobile:px-4 mobile:py-4">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Detaljeret sammenligning
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
                          Nuværende
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {selectedPolicy.company || 'Din nuværende'}
                        </span>
                      </div>
                      <div className="flex grow shrink-0 basis-0 flex-col items-center">
                        <span className="text-body-bold font-body-bold text-default-font">
                          Nyt tilbud
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          Anbefaling
                        </span>
                      </div>
                    </div>
                    <div className="flex w-full min-w-[576px] flex-col items-start">
                      {healthCheckPayload.comparisonData.map((item: any, index: number) => {
                        const isIncluded = (value: string) => {
                          if (!value) return false;
                          const lowerValue = value.toLowerCase();
                          return lowerValue.includes('inkluderet') || lowerValue.includes('ja') || !lowerValue.includes('ikke');
                        };
                        
                        const currentIncluded = isIncluded(item.current);
                        const recommendationIncluded = isIncluded(item.recommendation);
                        
                        return (
                          <div 
                            key={index} 
                            className="flex w-full items-center gap-4 border-b border-solid border-neutral-border py-4"
                            data-testid={`comparison-row-${index}`}
                          >
                            <div className="flex w-48 flex-none flex-col items-start gap-1">
                              <span className="text-body-bold font-body-bold text-default-font">
                                {item.category}
                              </span>
                              {item.description && (
                                <span className="text-caption font-caption text-subtext-color">
                                  {item.description}
                                </span>
                              )}
                            </div>
                            <div className="flex grow shrink-0 basis-0 items-center justify-center">
                              <Badge variant={currentIncluded ? "success" : "error"}>
                                {item.current}
                              </Badge>
                            </div>
                            <div className="flex grow shrink-0 basis-0 items-center justify-center">
                              <Badge variant={recommendationIncluded ? "success" : "error"}>
                                {item.recommendation}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Low Confidence Warning */}
              {selectedPolicy.extractionConfidence != null && selectedPolicy.extractionConfidence < 60 && (
                <div className="flex w-full items-start gap-3 rounded-lg border border-solid border-warning-200 bg-warning-50 px-4 py-4">
                  <IconWithBackground
                    variant="warning"
                    size="small"
                    icon={<FeatherAlertCircle />}
                  />
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Lav udtræksikkerhed
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Nogle data kan være unøjagtige. Genindlæs eller upload et bedre dokument.
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
