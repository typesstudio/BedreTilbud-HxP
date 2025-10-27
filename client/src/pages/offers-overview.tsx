import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Badge, Button, IconWithBackground, Progress, DefaultPageLayout } from "@/ui";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FeatherArrowRight, FeatherMessageCircle, FeatherMail, FeatherShield } from "@subframe/core";
import UserSelector from "@/components/user-selector";

export default function OffersOverview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");

  if (!userId) {
    setLocation("/onboarding");
    return null;
  }

  // Get user stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats", userId],
  });

  // Get email threads
  const { data: threadsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/emails/threads", userId],
  });
  const threads = threadsResponse?.data || [];

  // Get comparisons
  const { data: comparisonsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/comparisons/user", userId],
  });
  const comparisons = comparisonsResponse?.data || [];

  // Check inbox mutation
  const checkInboxMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/emails/check-inbox", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/user", userId] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", userId] });
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [userId]);

  const getComparisonForThread = (threadId: string) => {
    return (comparisons as any[]).find((comp: any) => 
      (threads as any[]).find((t: any) => t.id === threadId && t.companyId === comp.companyId)
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const pendingThreads = (threads as any[]).filter((t: any) => t.status !== 'received' && !getComparisonForThread(t.id));
  const hasOffers = (comparisons as any[]).length > 0;
  const hasPending = pendingThreads.length > 0;

  return (
    <DefaultPageLayout
      breadcrumbs={[{ label: "Dine bedre tilbud", path: "/offers" }]}
      onNavigate={(path) => setLocation(path)}
      onProfileClick={() => setLocation(`/profile/${userId}`)}
      onSendInquiryClick={() => setLocation("/send-inquiry")}
    >
      <div className="container max-w-none flex h-full w-full flex-col items-center gap-12 bg-default-background py-12">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6">
          {/* Header Section */}
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Dine forsikringstilbud
            </span>
            <span className="text-body font-body text-subtext-color">
              Sammenlign og gennemgå forsikringstilbud skræddersyet til dig
            </span>
          </div>

          {/* Insurance Health Check Banner */}
          <div className="flex w-full items-start gap-4 rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4">
            <IconWithBackground 
              variant="success" 
              size="medium" 
              icon={<FeatherShield />}
            />
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3">
              <div className="flex flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-success-800">
                  Tjek din nuværende forsikring
                </span>
                <span className="text-caption font-caption text-success-700">
                  Få en gratis AI-analyse af din forsikring og se hvor du kan spare penge - uden at indhente tilbud
                </span>
              </div>
              <Button
                size="small"
                iconRight={<FeatherArrowRight />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/check")}
                data-testid="button-insurance-check"
              >
                Tjek min forsikring
              </Button>
            </div>
          </div>

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

          {/* Received Offers Section */}
          {hasOffers && (
            <div className="flex w-full flex-col items-start gap-4">
              {(comparisons as any[]).map((comparison: any) => {
                const currentPremium = comparison.currentDocument?.ocrData?.annualPremium || 0;
                const offerPremium = comparison.offerDocument?.ocrData?.annualPremium || 0;
                const monthlyCurrent = currentPremium / 12;
                const monthlyOffer = offerPremium / 12;
                const monthlySavings = (currentPremium - offerPremium) / 12;
                const yearlySavings = comparison.savings || 0;

                return (
                  <div 
                    key={comparison.id}
                    className="flex w-full items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm"
                    data-testid={`comparison-card-${comparison.id}`}
                  >
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4">
                      <div className="flex w-full items-start justify-between">
                        <span className="text-heading-3 font-heading-3 text-default-font">
                          {comparison.company?.name || 'Ukendt selskab'}
                        </span>
                        <Badge variant="neutral">
                          Modtaget den {new Date(comparison.createdAt).toLocaleDateString('da-DK')}
                        </Badge>
                      </div>
                      <div className="flex w-full flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body font-body text-subtext-color">
                            Nuværende præmie
                          </span>
                          <span className="text-body font-body text-default-font">
                            {formatCurrency(monthlyCurrent)}/måned
                          </span>
                        </div>
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body-bold font-body-bold text-brand-600">
                            Nyt tilbud
                          </span>
                          <span className="text-body-bold font-body-bold text-brand-600">
                            {formatCurrency(monthlyOffer)}/måned
                          </span>
                        </div>
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body font-body text-brand-600">
                            Månedlig besparelse
                          </span>
                          <span className="text-body font-body text-brand-600">
                            {formatCurrency(monthlySavings)}
                          </span>
                        </div>
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body font-body text-brand-600">
                            Årlig besparelse
                          </span>
                          <span className="text-body font-body text-brand-600">
                            {formatCurrency(yearlySavings)}
                          </span>
                        </div>
                      </div>
                      <Button
                        iconRight={<FeatherArrowRight />}
                        onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation(`/comparison/${comparison.id}`)}
                        data-testid={`button-view-comparison-${comparison.id}`}
                      >
                        Se sammenligning
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Offers Section */}
          {hasPending && (
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Afventende tilbud
              </span>
              <div className="flex w-full flex-col items-start gap-4">
                {pendingThreads.map((thread: any) => {
                  const statusMap: { [key: string]: { variant: "warning" | "neutral" | "success" | "error" | "brand", text: string, progress: number } } = {
                    sent: { variant: "warning", text: "Forhandler", progress: 80 },
                    pending: { variant: "neutral", text: "Behandler", progress: 25 }
                  };
                  
                  const status = statusMap[thread.status] || { variant: "neutral" as const, text: "Afventer", progress: 50 };

                  return (
                    <div 
                      key={thread.id}
                      className="flex w-full items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm"
                      data-testid={`pending-card-${thread.id}`}
                    >
                      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4">
                        <div className="flex w-full items-start justify-between">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-heading-3 font-heading-3 text-default-font">
                              {thread.company?.name || 'Ukendt selskab'}
                            </span>
                            <span className="text-body font-body text-subtext-color">
                              Forsikringsforespørgsel
                            </span>
                          </div>
                          <Badge variant={status.variant}>{status.text}</Badge>
                        </div>
                        <div className="flex w-full flex-col items-start gap-2">
                          <span className="text-body font-body text-default-font">
                            {thread.company?.description || 'Venter på tilbud fra forsikringsselskabet'}
                          </span>
                          <div className="flex w-full flex-col items-start gap-1">
                            <span className="text-caption font-caption text-subtext-color">
                              Estimeret svar
                            </span>
                            <Progress value={status.progress} />
                            <span className="text-caption font-caption text-subtext-color">
                              {thread.status === 'sent' ? '2 dage' : '4 dage'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Offer Button */}
          {(hasOffers || hasPending) && (
            <Button
              variant="neutral-primary"
              iconRight={<FeatherMail />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/upload-offer")}
              data-testid="button-upload-offer"
            >
              Upload modtaget tilbud
            </Button>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}
