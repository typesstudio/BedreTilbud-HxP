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
    queryKey: ['/api/policies/user', userId],
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
      queryClient.invalidateQueries({ queryKey: ['/api/policies/user', userId] });
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
                  Upload dine forsikringer for at få et detaljeret tjek
                </span>
              </div>
              <Button
                variant="brand-primary"
                size="medium"
                className="h-12"
                data-testid="button-upload-policy"
              >
                Upload forsikring
              </Button>
            </div>
            );
          })()}

          {/* Health Check Results */}
          {selectedPolicy && (
            <>
              {/* Annual Savings Card */}
              {healthCheckSavingsAnnual != null && healthCheckSavingsAnnual > 0 && (
                <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-brand-50 px-6 py-6 mobile:px-4 mobile:py-4">
                  <div className="flex w-full items-center justify-between gap-4 mobile:flex-col mobile:items-start">
                    <div className="flex flex-col items-start gap-2">
                      <span className="text-heading-3 font-heading-3 text-default-font">
                        Årlig potentiel besparelse
                      </span>
                      <span className="text-heading-1 font-heading-1 text-brand-700 mobile:text-heading-2 mobile:font-heading-2">
                        {formatCurrency(healthCheckSavingsAnnual)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 mobile:items-start mobile:w-full">
                      <span className="text-body-bold font-body-bold text-brand-700">
                        Din årlige besparelse
                      </span>
                      {savingsPercentage && (
                        <span className="text-body font-body text-brand-600">
                          {savingsPercentage}% lavere omkostning
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="neutral-secondary"
                    size="small"
                    icon={<FeatherRefreshCw />}
                    loading={refreshMutation.isPending}
                    onClick={() => selectedPolicy.id && refreshMutation.mutate(selectedPolicy.id)}
                    data-testid="button-refresh-health-check"
                  >
                    Genindlæs tjek
                  </Button>
                </div>
              )}

              {/* Strengths Cards */}
              {healthCheckPayload?.strengths && healthCheckPayload.strengths.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4">
                  <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
                    Højdepunkter hvor anbefalingen er bedre
                  </span>
                  <div className="flex w-full flex-wrap items-start gap-4">
                    {healthCheckPayload.strengths.map((strength: any, index: number) => {
                      const IconComponent = iconMap[strength.icon] || FeatherCheck;
                      return (
                        <div
                          key={index}
                          className="flex min-w-[280px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-lg border border-solid border-success-200 bg-success-50 px-4 py-4 mobile:min-w-full"
                          data-testid={`strength-${index}`}
                        >
                          <IconWithBackground
                            variant="success"
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
                <div className="flex w-full flex-col items-start gap-4">
                  <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
                    Detaljeret sammenligning
                  </span>
                  
                  {/* Desktop Table */}
                  <div className="hidden md:block w-full overflow-x-auto">
                    <div className="min-w-[576px]">
                      <Table
                        header={
                          <Table.HeaderRow>
                            <Table.HeaderCell>Dækning</Table.HeaderCell>
                            <Table.HeaderCell>Nuværende</Table.HeaderCell>
                            <Table.HeaderCell>Nyt tilbud</Table.HeaderCell>
                          </Table.HeaderRow>
                        }
                      >
                        {healthCheckPayload.comparisonData.map((item: any, index: number) => (
                          <Table.Row key={index} data-testid={`comparison-row-${index}`}>
                            <Table.Cell>
                              <span className="text-body-bold font-body-bold text-default-font">
                                {item.category}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <span className="text-body font-body text-default-font">
                                {item.current}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="flex items-center gap-2">
                                <span className="text-body font-body text-default-font">
                                  {item.recommendation}
                                </span>
                                {item.status && (
                                  <Badge variant={item.status === 'better' ? 'success' : item.status === 'worse' ? 'error' : 'neutral'}>
                                    {item.status === 'better' ? 'Bedre' : item.status === 'worse' ? 'Værre' : 'Samme'}
                                  </Badge>
                                )}
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table>
                    </div>
                  </div>

                  {/* Mobile Card View */}
                  <div className="block md:hidden w-full">
                    <MobileComparisonCard 
                      rows={healthCheckPayload.comparisonData.map((item: any) => ({
                        feature: item.category,
                        current: item.current,
                        offer: item.recommendation,
                        difference: item.status === 'better' ? 'Bedre' : item.status === 'worse' ? 'Værre' : 'Samme',
                        status: item.status,
                        isCategory: false
                      }))}
                    />
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
