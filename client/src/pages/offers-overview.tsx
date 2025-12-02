import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Badge, Button, IconWithBackground, Progress, DefaultPageLayout } from "@/ui";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FeatherArrowRight, FeatherMessageCircle, FeatherShield, FeatherCheckCircle } from "@subframe/core";
import UserSelector from "@/components/user-selector";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import LoadingOffers from "@/components/loading/LoadingOffers";
import { OfferInsightsCard, PendingOfferCard, OfferHighlight } from "@/components/OfferInsightsCard";

export default function OffersOverview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");

  if (!userId) {
    setLocation("/onboarding");
    return null;
  }

  // Get user stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats", userId],
  });

  // Get email threads
  const { data: threadsResponse, isLoading: isLoadingThreads } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/emails/threads", userId],
  });
  const threads = threadsResponse?.data || [];

  // Get all offers with comparison status (now includes comparisonData from company_comparisons)
  const { data: offersResponse, isLoading: isLoadingOffers } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/offers/user", userId],
  });
  const offers = offersResponse?.data || [];

  // Check inbox mutation
  const checkInboxMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/emails/check-inbox", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", userId] });
      toast({
        title: "Indbakke tjekket",
        description: "Nye emails er blevet hentet",
      });
    },
    onError: () => {
      toast({
        title: "Fejl",
        description: "Kunne ikke tjekke indbakke",
        variant: "destructive",
      });
    },
  });

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 30 * 1000; // 30 seconds
    
    const intervalId = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", userId] });
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [userId]);

  // Show loading skeleton while initial data is loading (must be after all hooks)
  const isInitialLoading = isLoadingStats || isLoadingThreads || isLoadingOffers;

  if (isInitialLoading) {
    return (
      <AppLayoutWithNav userId={userId}>
        <LoadingOffers />
      </AppLayoutWithNav>
    );
  }

  const getComparisonForThread = (threadId: string) => {
    // Find offers that match the thread's company
    const thread = (threads as any[]).find((t: any) => t.id === threadId);
    if (!thread) return null;
    
    return allOffers.find((offer: any) => 
      offer.company?.id === thread.companyId && offer.comparisonStatus === 'ok'
    );
  };

  // Use offers endpoint - show ALL offers regardless of comparison status
  const allOffers = offers || [];
  
  // Separate offers by comparison status
  const offersWithComparisons = allOffers.filter((o: any) => o.comparisonStatus === 'ok');
  const failedOffers = allOffers.filter((o: any) => o.comparisonStatus === 'failed');
  const pendingOffers = allOffers.filter((o: any) => o.comparisonStatus === 'pending');

  // Extract top 4 highlights from comparison data
  const extractTop4Highlights = (comparisonData: any): OfferHighlight[] => {
    const policyComparisons = comparisonData?.policyComparisons || [];
    const overall = comparisonData?.overall || {};
    const totalSavings = overall.annualSavings || 0;
    const allHighlights: OfferHighlight[] = [];
    
    // Collect all highlights from all policy comparisons
    // For policies with positive savings, highlights are positive
    // For policies with negative savings (price increase), mark as negative
    // Zero-delta policies are treated as neutral (positive)
    policyComparisons.forEach((policy: any, policyIndex: number) => {
      const policySavings = policy.costSummary?.annualSavings ?? 0;
      // Treat zero or positive savings as positive (better or neutral offer)
      const isPolicyCheaperOrEqual = policySavings >= 0;
      
      if (policy.highlights && Array.isArray(policy.highlights)) {
        policy.highlights.forEach((h: any, hIndex: number) => {
          // Check if highlight has explicit variant, otherwise determine from policy savings
          const variant = h.variant?.toLowerCase();
          let isPositive: boolean;
          
          if (variant === "error" || variant === "warning") {
            isPositive = false;
          } else if (variant === "success") {
            isPositive = true;
          } else {
            // No explicit variant: use policy savings to determine
            // Zero or positive savings = positive highlight
            // Negative savings = negative highlight
            isPositive = isPolicyCheaperOrEqual;
          }
          
          allHighlights.push({
            id: `${policyIndex}-${hIndex}`,
            title: h.title || h.description || "Forbedret dækning",
            isPositive,
          });
        });
      }
    });
    
    // If no highlights from API, generate some based on savings/cost data
    if (allHighlights.length === 0) {
      if (totalSavings > 0) {
        allHighlights.push({
          id: "savings-1",
          title: `Sparer ${formatNumber(totalSavings)} kr årligt`,
          isPositive: true,
        });
      } else if (totalSavings < 0) {
        allHighlights.push({
          id: "increase-1",
          title: `Prisstigning på ${formatNumber(Math.abs(totalSavings))} kr årligt`,
          isPositive: false,
        });
      }
      
      // Add policy-specific highlights based on cost differences
      // Skip zero-delta policies (no change) as they are neutral
      policyComparisons.forEach((policy: any, idx: number) => {
        const policySavings = policy.costSummary?.annualSavings ?? 0;
        const policyLabel = policy.label || capitalizeFirst(policy.policyType);
        
        if (policySavings > 0) {
          allHighlights.push({
            id: `policy-${idx}`,
            title: `${policyLabel}: Lavere pris`,
            isPositive: true,
          });
        } else if (policySavings < 0) {
          allHighlights.push({
            id: `policy-neg-${idx}`,
            title: `${policyLabel}: Højere pris`,
            isPositive: false,
          });
        }
        // policySavings === 0 is neutral, skip it
      });
    }
    
    return allHighlights.slice(0, 4);
  };

  const capitalizeFirst = (str: string): string => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatNumber = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  // Build companiesWithOffers from offersWithComparisons (new company_comparisons data)
  const companiesWithOffers = offersWithComparisons.length > 0 
    ? offersWithComparisons.map((offer: any) => {
        const comparisonData = offer.comparisonData || {};
        const overall = comparisonData.overall || {};
        const policyComparisons = comparisonData.policyComparisons || [];
        
        // Get the first offer snapshot ID for navigating to sundhedstjek
        const firstOfferSnapshotId = policyComparisons.find((pc: any) => pc.offerPolicyId)?.offerPolicyId || null;
        
        return {
          id: offer.id,
          companyId: offer.company?.id,
          company: offer.company,
          totalSavings: overall.annualSavings || 0,
          currentPremium: overall.totalCurrentAnnualPremium || 0,
          offerPremium: overall.totalOfferAnnualPremium || 0,
          policyCount: policyComparisons.length,
          policies: policyComparisons.map((pc: any) => pc.policyType).filter(Boolean),
          createdAt: offer.createdAt,
          comparisonId: offer.comparisonId,
          comparisonStatus: offer.comparisonStatus,
          highlights: extractTop4Highlights(comparisonData),
          firstOfferSnapshotId,
          notificationStatus: offer.notificationStatus,
          notificationError: offer.notificationError,
        };
      })
    : [];
  
  // Step 5.1: Check if any comparisons had failed notifications
  const offersWithFailedNotification = companiesWithOffers.filter(
    (o: any) => o.notificationStatus === 'failed'
  );

  const pendingThreads = (threads as any[]).filter((t: any) => t.status !== 'received' && !getComparisonForThread(t.id));
  const hasOffers = companiesWithOffers.length > 0 || failedOffers.length > 0 || pendingOffers.length > 0;
  const hasPending = pendingThreads.length > 0;

  return (
    <AppLayoutWithNav userId={userId}>
      <DefaultPageLayout
        breadcrumbs={[{ label: "Dine bedre tilbud", path: "/offers" }]}
        onNavigate={(path) => setLocation(path)}
        onProfileClick={() => setLocation(`/profile/${userId}`)}
        onSendInquiryClick={() => setLocation("/selskaber")}
      >
      <div className="container max-w-none flex h-full w-full flex-col items-center gap-8 bg-default-background py-12">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-2">
          <div className="flex w-full items-start justify-between">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Dine forsikringstilbud
            </span>
            <Button
              variant="brand-secondary"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/selskaber")}
              data-testid="button-get-more-offers"
            >
              Få flere bedre tilbud
            </Button>
          </div>
          <span className="text-body font-body text-subtext-color">
            Sammenlign dækning, priser og betingelser side om side
          </span>
        </div>

        <div className="flex w-full max-w-[768px] flex-col items-start gap-4">
          {/* AI Negotiating Banner */}
          {hasPending && (
            <div className="flex w-full items-center gap-4 rounded-md bg-brand-50 px-6 py-4">
              <IconWithBackground size="small" icon={<FeatherMessageCircle />} />
              <div className="flex grow shrink-0 basis-0 flex-col items-start">
                <span className="text-body-bold font-body-bold text-brand-700">
                  Vi henter flere tilbud til dig
                </span>
                <span className="text-body font-body text-brand-700">
                  Vores AI forhandler med {pendingThreads.length} forsikringsselskaber. Vi giver dig besked når nye tilbud er tilgængelige.
                </span>
              </div>
            </div>
          )}

          {/* Step 5.1: Notification Failure Banner */}
          {offersWithFailedNotification.length > 0 && (
            <div 
              className="flex w-full items-start gap-4 rounded-md bg-warning-50 border border-warning-200 px-6 py-4"
              data-testid="notification-failure-banner"
            >
              <IconWithBackground size="small" icon={<FeatherCheckCircle />} />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-warning-700">
                  Dine resultater er klar her i BedreTilbud
                </span>
                <span className="text-body font-body text-warning-600">
                  Vi kunne desværre ikke sende dig en email om det, men du kan se alle sammenligninger nedenfor.
                </span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!hasOffers && !hasPending && (
            <div className="flex w-full flex-col items-center gap-6 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-12 text-center">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Ingen forespørgsler endnu
              </span>
              <span className="text-body font-body text-subtext-color">
                Start med at uploade dine forsikringsdokumenter og send forespørgsler til selskaber.
              </span>
              <Button
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/onboarding")}
                data-testid="button-start-onboarding"
              >
                Kom i gang
              </Button>
            </div>
          )}

          {/* Received Offers Section - using new OfferInsightsCard */}
          {companiesWithOffers.length > 0 && (
            <>
              {(companiesWithOffers as any[]).map((companyOffer: any) => {
                const yearlySavings = companyOffer.totalSavings || 0;
                const monthlySavings = yearlySavings / 12;

                return (
                  <OfferInsightsCard
                    key={companyOffer.id}
                    companyName={companyOffer.company?.name || "Ukendt selskab"}
                    companyLogoUrl={companyOffer.company?.logoUrl}
                    policyTypes={companyOffer.policies}
                    currentPremium={companyOffer.currentPremium}
                    offerPremium={companyOffer.offerPremium}
                    monthlySavings={monthlySavings}
                    yearlySavings={yearlySavings}
                    highlights={companyOffer.highlights}
                    onViewInsurance={() => {
                      if (companyOffer.firstOfferSnapshotId) {
                        setLocation(`/sundhedstjek/${companyOffer.firstOfferSnapshotId}`);
                      } else {
                        setLocation(`/sammenligning/${companyOffer.comparisonId}`);
                      }
                    }}
                    onViewComparison={() => setLocation(`/sammenligning/${companyOffer.comparisonId}`)}
                  />
                );
              })}
            </>
          )}

          {/* Pending Offers from threads */}
          {pendingThreads.map((thread: any) => (
            <PendingOfferCard
              key={thread.id}
              companyName={thread.company?.name || "Ukendt selskab"}
              companyLogoUrl={thread.company?.logoUrl}
              policyTypes={[]}
              status={thread.status === "sent" ? "fetching" : "pending"}
              statusText={thread.status === "sent" ? "Forhandler tilbud..." : "Afventer svar..."}
            />
          ))}

          {/* Failed/Pending Uploaded Offers Section */}
          {(failedOffers.length > 0 || pendingOffers.length > 0) && (
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Uploadede tilbud
              </span>
              <div className="flex w-full flex-col items-start gap-4">
                {[...failedOffers, ...pendingOffers].map((offer: any) => (
                  <div 
                    key={offer.id}
                    className="flex w-full flex-col md:flex-row items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm"
                    data-testid={`offer-card-${offer.id}`}
                  >
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4">
                      <div className="flex w-full items-start justify-between flex-wrap gap-2">
                        <span className="text-heading-3 font-heading-3 text-default-font">
                          {offer.company?.name || 'Ukendt selskab'}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {offer.comparisonStatus === 'failed' && (
                            <Badge variant="warning" data-testid={`badge-failed-${offer.id}`}>
                              Kan ikke sammenlignes
                            </Badge>
                          )}
                          {offer.comparisonStatus === 'pending' && (
                            <Badge variant="neutral" data-testid={`badge-pending-${offer.id}`}>
                              Afventer sammenligning
                            </Badge>
                          )}
                          <Badge variant="neutral">
                            {new Date(offer.createdAt).toLocaleDateString('da-DK')}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex w-full flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body font-body text-subtext-color">
                            Antal forsikringer
                          </span>
                          <span className="text-body font-body text-default-font">
                            {offer.snapshotCount} {offer.snapshotCount === 1 ? 'forsikring' : 'forsikringer'}
                          </span>
                        </div>
                        {offer.comparisonStatus === 'failed' && (
                          <div className="flex w-full flex-col items-start gap-2 mt-2 p-3 bg-warning-50 rounded">
                            {offer.statusReason === 'MISSING_STRUCTURED_POLICY_CURRENT' && (
                              <>
                                <span className="text-caption-bold font-caption-bold text-warning-700">
                                  Dine nuværende forsikringer mangler data
                                </span>
                                <span className="text-caption font-caption text-warning-600">
                                  Dine uploadede forsikringer blev ikke korrekt behandlet. Prøv at uploade dem igen eller kontakt support.
                                </span>
                                <Button
                                  size="small"
                                  variant="brand-primary"
                                  className="mt-2"
                                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/onboarding")}
                                  data-testid={`button-reupload-current-${offer.id}`}
                                >
                                  Upload forsikringer igen
                                </Button>
                              </>
                            )}
                            {offer.statusReason === 'MISSING_STRUCTURED_POLICY_OFFER' && (
                              <>
                                <span className="text-caption-bold font-caption-bold text-warning-700">
                                  Tilbuddet kunne ikke læses korrekt
                                </span>
                                <span className="text-caption font-caption text-warning-600">
                                  Dette tilbud blev ikke korrekt behandlet af vores system. Prøv at uploade det igen eller kontakt support.
                                </span>
                                <Button
                                  size="small"
                                  variant="brand-primary"
                                  className="mt-2"
                                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/upload-offer")}
                                  data-testid={`button-reupload-offer-${offer.id}`}
                                >
                                  Upload tilbud igen
                                </Button>
                              </>
                            )}
                            {offer.statusReason === 'NO_MATCHED_PAIRS' && (
                              <>
                                <span className="text-caption-bold font-caption-bold text-warning-700">
                                  Ingen matchende forsikringer fundet
                                </span>
                                <span className="text-caption font-caption text-warning-600">
                                  Dette tilbud indeholder ikke forsikringer der matcher dine nuværende. Upload dine nuværende forsikringer eller kontakt support.
                                </span>
                                <Button
                                  size="small"
                                  variant="brand-primary"
                                  className="mt-2"
                                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/onboarding")}
                                  data-testid={`button-upload-current-${offer.id}`}
                                >
                                  Upload nuværende forsikringer
                                </Button>
                              </>
                            )}
                            {!offer.statusReason && (
                              <>
                                <span className="text-caption-bold font-caption-bold text-warning-700">
                                  Sammenligning ikke tilgængelig
                                </span>
                                <span className="text-caption font-caption text-warning-600">
                                  For at sammenligne dette tilbud skal du uploade dine nuværende forsikringer først.
                                </span>
                                <Button
                                  size="small"
                                  variant="brand-primary"
                                  className="mt-2"
                                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/onboarding")}
                                  data-testid={`button-upload-current-${offer.id}`}
                                >
                                  Upload nuværende forsikringer
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA Section at bottom */}
          <div className="flex w-full flex-col items-center gap-4 py-8 bg-neutral-50 rounded-lg mt-4">
            <span className="text-heading-2 font-heading-2 text-default-font text-center">
              Sammenlign flere tilbud
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              Indhent og sammenlign flere tilbud for at sikre de bedste besparelser
            </span>
            <Button
              variant="brand-primary"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/selskaber")}
              data-testid="button-get-more-offers-cta"
            >
              Få flere bedre tilbud
            </Button>
            <div className="flex items-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <FeatherCheckCircle className="text-success-600 h-4 w-4" />
                <span className="text-caption font-caption text-subtext-color">100% gratis</span>
              </div>
              <div className="flex items-center gap-2">
                <FeatherCheckCircle className="text-success-600 h-4 w-4" />
                <span className="text-caption font-caption text-subtext-color">Bedre besparelser</span>
              </div>
              <div className="flex items-center gap-2">
                <FeatherCheckCircle className="text-success-600 h-4 w-4" />
                <span className="text-caption font-caption text-subtext-color">Ingen binding</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
    </AppLayoutWithNav>
  );
}
