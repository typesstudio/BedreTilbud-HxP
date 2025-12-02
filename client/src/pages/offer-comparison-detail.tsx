import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { ComparisonHeader } from "@/components/comparison/ComparisonHeader";
import { ComparisonTabs } from "@/components/comparison/ComparisonTabs";
import { ComparisonHighlights, Highlight } from "@/components/comparison/ComparisonHighlights";
import { ComparisonDetailedMatrix, CoverageRow } from "@/components/comparison/ComparisonDetailedMatrix";
import { usePolicyComparisons, type PolicyComparisonRow } from "@/hooks/usePolicyComparisons";
import { AlertTriangle } from "lucide-react";
import {
  FeatherArrowRight,
  FeatherPiggyBank,
} from "@subframe/core";

export default function OfferComparisonDetail() {
  const { policyType } = useParams<{ policyType: string }>();
  const [, setLocation] = useLocation();
  const { data, isLoading } = usePolicyComparisons();
  const userId = localStorage.getItem("userId");

  const comparisons = data?.comparisons || [];
  
  // Fetch email threads to enable messaging
  const { data: threadsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/emails/threads", userId],
    enabled: !!userId,
  });
  const threads = threadsResponse?.data || [];

  const currentComparison = useMemo(() => {
    return comparisons.find((c: any) => c.policyType === policyType);
  }, [comparisons, policyType]);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "Afventer";
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  if (isLoading) {
    return (
      <DefaultPageLayout>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-body font-body text-subtext-color">Indlæser sammenligning...</p>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (!currentComparison) {
    return (
      <DefaultPageLayout>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">Sammenligning ikke fundet</h2>
            <Button onClick={() => setLocation("/sammenligning")} className="h-12 touch-target">
              Tilbage til oversigt
            </Button>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  // Step 4.1: Check if this policy is missing from the offer
  const isMissingInOffer = currentComparison.matchStatus === 'current_only';
  const policyLabel = policyType ? policyType.charAt(0).toUpperCase() + policyType.slice(1) : 'Forsikring';

  const currentPremium = currentComparison.current?.pricing?.annualPremium;
  const currentCompanyName = currentComparison.current?.companyName || "Din nuværende";
  const offers = currentComparison.offers || [];
  const cheapestOffer = offers[0];
  const offerPremium = cheapestOffer?.pricing?.annualPremium;
  const offerCompanyName = cheapestOffer?.companyName || "Tilbud";
  const savings = cheapestOffer?.savingsAnnual || 0;
  const savingsPercentage = currentPremium && currentPremium > 0 
    ? (savings / currentPremium) * 100 
    : 0;
  
  // Find thread for messaging (match by company name from thread payload)
  const thread = threads.find((t: any) => t.company?.companyName === offerCompanyName);
  const threadId = thread?.id;

  // TODO: Replace with real highlights data from API when available
  const highlights: Highlight[] = [];

  // TODO: Replace with real detailed comparison rows from API when available
  const detailedRows: CoverageRow[] = [];

  const hasPricing = currentPremium && offerPremium;
  const isWorseOffer = savings < 0;
  const savingsVariant = isWorseOffer ? "error" : "success";

  // Step 4.1: Show empty state for policies without offers
  if (isMissingInOffer) {
    return (
      <DefaultPageLayout>
        <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
          <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
            
            <ComparisonHeader
              title={`${policyLabel} sammenligning`}
              subtitle="Sammenlign og gennemgå forsikringstilbud tilpasset dig"
              onSeDetaljerClick={() => setLocation("/sammenligning")}
              onSeSundhedstjekClick={() => setLocation("/check")}
              showDetaljerButton={true}
              showBeskederButton={false}
              showSundhedstjekButton={true}
            />

            <ComparisonTabs
              selectedTab={policyType || "samlet"}
              onTabChange={(tab) => {
                if (tab === "samlet") {
                  setLocation("/sammenligning");
                } else {
                  setLocation(`/sammenligning/tilbud/${tab}`);
                }
              }}
            />

            {/* Empty State for Missing Policy */}
            <div 
              className="flex w-full flex-col items-center gap-6 rounded-lg border border-warning-200 bg-warning-50 px-8 py-12"
              data-testid="empty-state-missing-offer"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-100">
                <AlertTriangle className="h-8 w-8 text-warning-600" />
              </div>
              
              <div className="flex flex-col items-center gap-2 text-center">
                <h2 className="text-heading-2 font-heading-2 text-warning-800">
                  Intet tilbud på {policyLabel}
                </h2>
                <p className="text-body font-body text-warning-700 max-w-md">
                  Det modtagne tilbud inkluderer ikke en {policyLabel.toLowerCase()}. 
                  Du har stadig din nuværende {policyLabel.toLowerCase()} hos {currentCompanyName}.
                </p>
                {currentPremium && (
                  <p className="text-body-bold font-body-bold text-warning-800 mt-2">
                    Nuværende årlig pris: {new Intl.NumberFormat("da-DK").format(currentPremium)} kr
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button 
                  variant="brand-primary" 
                  size="large" 
                  className="w-full h-12"
                  onClick={() => setLocation("/sammenligning")}
                  data-testid="button-back-to-overview"
                >
                  Se samlet oversigt
                </Button>
                <Button 
                  variant="neutral-secondary" 
                  size="large" 
                  className="w-full h-12"
                  onClick={() => setLocation("/check")}
                  data-testid="button-view-healthcheck"
                >
                  Se sundhedstjek
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
          
          <ComparisonHeader
            title={`${offerCompanyName} sammenligning`}
            subtitle="Sammenlign og gennemgå forsikringstilbud tilpasset dig"
            onSeDetaljerClick={() => setLocation("/sammenligning")}
            onSeBeskederClick={() => threadId && setLocation(`/emails/${threadId}`)}
            onSeSundhedstjekClick={() => setLocation("/check")}
            showDetaljerButton={true}
            showBeskederButton={!!threadId}
            showSundhedstjekButton={true}
          />

          <ComparisonTabs
            selectedTab={policyType || "samlet"}
            onTabChange={(tab) => {
              if (tab === "samlet") {
                setLocation("/sammenligning");
              } else {
                setLocation(`/sammenligning/tilbud/${tab}`);
              }
            }}
          />

          {/* Annual Cost Comparison */}
          {hasPricing && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
              <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
                Årlig omkostning sammenligning
              </span>
              <div className={`flex w-full items-center justify-between rounded-lg border border-solid px-6 py-4 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2 mobile:px-4 mobile:py-3 ${
                isWorseOffer 
                  ? 'border-error-200 bg-error-50' 
                  : 'border-success-200 bg-success-50'
              }`}>
                <span className={`text-heading-1 font-heading-1 mobile:text-heading-2 mobile:font-heading-2 mobile:self-end ${
                  isWorseOffer ? 'text-error-600' : 'text-success-600'
                }`}>
                  {formatCurrency(Math.abs(savings))}
                </span>
                <div className="flex items-center gap-3">
                  <IconWithBackground
                    variant={savingsVariant}
                    size="medium"
                    icon={<FeatherPiggyBank />}
                  />
                  <div className="flex flex-col items-start gap-1">
                    <span className={`text-body-bold font-body-bold ${
                      isWorseOffer ? 'text-error-700' : 'text-success-700'
                    }`}>
                      {isWorseOffer ? 'Dyrere tilbud' : 'Din årlige besparelse'}
                    </span>
                    <span className={`text-caption font-caption ${
                      isWorseOffer ? 'text-error-600' : 'text-success-600'
                    }`}>
                      {Math.abs(savingsPercentage).toFixed(1)}% {isWorseOffer ? 'højere' : 'lavere'} omkostning
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex w-full items-center gap-4 mobile:flex-col mobile:items-stretch">
                <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
                  <span className="text-caption font-caption text-subtext-color">
                    Nuværende ({currentCompanyName})
                  </span>
                  <span className="text-heading-2 font-heading-2 text-default-font">
                    {formatCurrency(currentPremium)}
                  </span>
                </div>
                <FeatherArrowRight className={`text-heading-2 font-heading-2 mobile:hidden ${
                  isWorseOffer ? 'text-error-600' : 'text-success-600'
                }`} />
                <div className={`flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md px-4 py-4 ${
                  isWorseOffer ? 'bg-error-50' : 'bg-success-50'
                }`}>
                  <span className={`text-caption font-caption ${
                    isWorseOffer ? 'text-error-600' : 'text-success-600'
                  }`}>
                    Ny pris ({offerCompanyName})
                  </span>
                  <span className={`text-heading-2 font-heading-2 ${
                    isWorseOffer ? 'text-error-700' : 'text-success-700'
                  }`}>
                    {formatCurrency(offerPremium)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <ComparisonHighlights 
            highlights={highlights}
            title={isWorseOffer ? 'Højdepunkter hvor tilbuddet er dårligere' : 'Højdepunkter hvor anbefalingen er bedre'}
          />

          <ComparisonDetailedMatrix
            currentCompanyName={currentCompanyName}
            offerCompanyName={offerCompanyName}
            rows={detailedRows}
          />
        </div>
      </div>
    </DefaultPageLayout>
  );
}
