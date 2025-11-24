import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Table } from "@/ui/components/Table";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { ComparisonHeader } from "@/components/comparison/ComparisonHeader";
import { ComparisonTabs, policyTypeIcons } from "@/components/comparison/ComparisonTabs";
import { ComparisonHighlights, Highlight } from "@/components/comparison/ComparisonHighlights";
import { ComparisonDetailedMatrix, CoverageRow } from "@/components/comparison/ComparisonDetailedMatrix";
import { usePolicyComparisons } from "@/hooks/usePolicyComparisons";
import {
  FeatherHome,
  FeatherShield,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
} from "@subframe/core";

export default function OfferComparisonAll() {
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState("samlet");
  const { data, isLoading } = usePolicyComparisons();
  const userId = localStorage.getItem("userId");

  const comparisons = data?.comparisons || [];
  
  // Fetch email threads to enable messaging
  const { data: threadsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/emails/threads", userId],
    enabled: !!userId,
  });
  const threads = threadsResponse?.data || [];

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "Afventer";
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  // Calculate overall savings
  const overallStats = useMemo(() => {
    let totalCurrentPremium = 0;
    let totalOfferPremium = 0;
    let count = 0;

    comparisons.forEach((comp: any) => {
      const currentPremium = comp.current?.pricing?.annualPremium;
      const offers = comp.offers || [];
      const cheapestOffer = offers.reduce((min: any, offer: any) => {
        const offerPremium = offer.pricing?.annualPremium;
        const minPremium = min?.pricing?.annualPremium;
        if (!offerPremium) return min;
        if (!minPremium) return offer;
        return offerPremium < minPremium ? offer : min;
      }, null);

      if (currentPremium && cheapestOffer?.pricing?.annualPremium) {
        totalCurrentPremium += currentPremium;
        totalOfferPremium += cheapestOffer.pricing.annualPremium;
        count++;
      }
    });

    const totalSavings = totalCurrentPremium - totalOfferPremium;
    const savingsPercentage = totalCurrentPremium > 0 
      ? (totalSavings / totalCurrentPremium) * 100 
      : 0;

    return {
      totalCurrentPremium,
      totalOfferPremium,
      totalSavings,
      savingsPercentage,
      count,
    };
  }, [comparisons]);

  // TODO: Replace with real highlights data from API when available
  const highlights: Highlight[] = [];

  // TODO: Replace with real detailed comparison rows from API when available
  const detailedRows: CoverageRow[] = [];

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

  const currentCompanyName = comparisons[0]?.current?.companyName || "Din nuværende";
  const offerCompanyName = comparisons[0]?.offers?.[0]?.companyName || "Tryg";
  
  // Find thread for messaging (match by company name from thread payload)
  const thread = threads.find((t: any) => t.company?.companyName === offerCompanyName);
  const threadId = thread?.id;

  return (
    <DefaultPageLayout>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
          
          <ComparisonHeader
            title={`${offerCompanyName} sammenligning`}
            subtitle="Sammenlign og gennemgå forsikringstilbud tilpasset dig"
            onSeBeskederClick={() => threadId && setLocation(`/emails/${threadId}`)}
            onSeSundhedstjekClick={() => setLocation("/check")}
            showBeskederButton={!!threadId}
            showSundhedstjekButton={true}
          />

          <ComparisonTabs
            selectedTab={selectedTab}
            onTabChange={(tab) => {
              if (tab === "samlet") {
                setSelectedTab(tab);
              } else {
                setLocation(`/sammenligning/tilbud/${tab}`);
              }
            }}
          />

          {/* Summary Cards */}
          <div className="flex w-full items-start gap-4 flex-wrap">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-50 px-6 py-6">
              <span className="text-body-bold font-body-bold text-neutral-600">
                Samlet besparelse
              </span>
              <span className="text-heading-1 font-heading-1 text-success-600">
                {formatCurrency(overallStats.totalSavings)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                {overallStats.savingsPercentage.toFixed(1)}% billigere
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
              <span className="text-body-bold font-body-bold text-neutral-600">
                {offerCompanyName} tilbud
              </span>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {formatCurrency(overallStats.totalOfferPremium)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Per år
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
              <span className="text-body-bold font-body-bold text-neutral-600">
                Din nuværende
              </span>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {formatCurrency(overallStats.totalCurrentPremium)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Per år
              </span>
            </div>
          </div>

          {/* Quick Comparison Table */}
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Hurtig sammenligning
            </span>
            <div className="flex w-full flex-col items-start rounded-lg border border-solid border-neutral-border bg-default-background overflow-x-auto">
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Kategori</Table.HeaderCell>
                    <Table.HeaderCell>Nuværende</Table.HeaderCell>
                    <Table.HeaderCell>Tilbud</Table.HeaderCell>
                    <Table.HeaderCell>Besparelse</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {comparisons.map((comp: any) => {
                  const Icon = policyTypeIcons[comp.policyType] || FeatherHome;
                  const currentPremium = comp.current?.pricing?.annualPremium;
                  const offers = comp.offers || [];
                  const cheapestOffer = offers[0]; // Already sorted by backend
                  const offerPremium = cheapestOffer?.pricing?.annualPremium;
                  const savings = cheapestOffer?.savingsAnnual;
                  const hasPricing = currentPremium && offerPremium;

                  return (
                    <Table.Row key={comp.policyType}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <IconWithBackground 
                            size="small" 
                            icon={<Icon />}
                            variant={hasPricing ? "neutral" : "warning"}
                          />
                          <span className={`whitespace-nowrap text-body-bold font-body-bold ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                            {comp.policyType.charAt(0).toUpperCase() + comp.policyType.slice(1)}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`whitespace-nowrap text-body font-body ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                          {formatCurrency(currentPremium)}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`whitespace-nowrap text-body font-body ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                          {formatCurrency(offerPremium)}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`whitespace-nowrap text-body-bold font-body-bold ${hasPricing ? 'text-success-600' : 'text-subtext-color'}`}>
                          {hasPricing ? formatCurrency(savings) : "—"}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant={hasPricing ? "brand-tertiary" : "neutral-tertiary"}
                          size="small"
                          onClick={() => setLocation(`/sammenligning/tilbud/${comp.policyType}`)}
                          data-testid={`button-details-${comp.policyType}`}
                        >
                          {hasPricing ? "Se detaljer" : "Afventer"}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table>
            </div>
          </div>

          <ComparisonHighlights highlights={highlights} />

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
