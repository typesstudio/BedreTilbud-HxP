import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import React from "react";
import { 
  Badge, 
  Button, 
  IconWithBackground, 
  Table, 
  DefaultPageLayout,
  AreaChart
} from "@/ui";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FeatherArrowLeft,
  FeatherArrowRight,
  FeatherArrowUp,
  FeatherPiggyBank,
  FeatherTrendingUp,
  FeatherTrendingDown,
  FeatherTruck,
  FeatherDroplet,
  FeatherShield,
  FeatherHome,
  FeatherClock,
  FeatherZap,
  FeatherCheck,
  FeatherInfo,
  FeatherMessageCircle,
  FeatherSend,
  FeatherDollarSign,
  FeatherHelpCircle,
  FeatherSquare,
  FeatherCheckSquare,
  FeatherAlertCircle
} from "@subframe/core";

const iconMap: { [key: string]: any } = {
  "trending-up": FeatherTrendingUp,
  "trending-down": FeatherTrendingDown,
  "truck": FeatherTruck,
  "droplet": FeatherDroplet,
  "shield": FeatherShield,
  "home": FeatherHome,
  "clock": FeatherClock,
  "zap": FeatherZap,
  "piggy-bank": FeatherPiggyBank,
  "dollar-sign": FeatherDollarSign,
  "help-circle": FeatherHelpCircle,
};

const severityColorMap: { [key: string]: string } = {
  "critical": "error",
  "important": "warning",
  "question": "neutral"
};

export default function Comparison() {
  const { id } = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["/api/comparisons", id],
    enabled: !!id,
  });

  // Get threads to find the thread ID for this comparison
  const userId = (comparison as any)?.userId;
  const companyId = (comparison as any)?.companyId;
  
  const { data: threads = [] } = useQuery({
    queryKey: ["/api/emails/threads", userId],
    enabled: !!userId,
  });

  // Send questions mutation
  const sendQuestionsMutation = useMutation({
    mutationFn: async (questionIds: string[]) => {
      const response = await apiRequest("POST", `/api/comparisons/${id}/send-questions`, { questionIds });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads", userId] });
      toast({
        title: "Spørgsmål sendt",
        description: `${selectedQuestionIds.length} spørgsmål er sendt til forsikringsselskabet`,
      });
      setSelectedQuestionIds([]);
    },
    onError: () => {
      toast({
        title: "Fejl",
        description: "Kunne ikke sende spørgsmål",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  if (isLoading) {
    return (
      <DefaultPageLayout
        breadcrumbs={[{ label: "Dine bedre tilbud", path: "/offers" }]}
        onNavigate={(path) => setLocation(path)}
        onProfileClick={() => setLocation(`/profile/${userId}`)}
        onSendInquiryClick={() => setLocation("/send-inquiry")}
      >
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-subtext-color">Indlæser sammenligning...</p>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (!comparison) {
    return (
      <DefaultPageLayout
        breadcrumbs={[{ label: "Dine bedre tilbud", path: "/offers" }]}
        onNavigate={(path) => setLocation(path)}
        onProfileClick={() => setLocation(`/profile/${userId}`)}
        onSendInquiryClick={() => setLocation("/send-inquiry")}
      >
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">Sammenligning ikke fundet</h2>
            <Button onClick={() => setLocation("/offers-overview")}>
              Tilbage til oversigt
            </Button>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  const comparisonData = (comparison as any).comparisonData || {};
  const currentPremium = (comparison as any).currentDocument?.ocrData?.annualPremium || 0;
  const offerPremium = (comparison as any).offerDocument?.ocrData?.annualPremium || 0;
  const savings = (comparison as any).savings || 0;
  const savingsPercentage = comparisonData.savingsPercentage || 0;
  const companyName = (comparison as any).company?.name || 'Ukendt selskab';
  const highlights = comparisonData.highlights || [];
  const detailedComparison = comparisonData.detailedComparison || [];
  const keyMetrics = comparisonData.keyMetrics || [];
  const addedBenefits = comparisonData.addedBenefits || [];
  const missingInfo = comparisonData.missingInfo || null;
  const cumulativeSavings = comparisonData.cumulativeSavings || null;
  
  // Determine if this is a worse offer (more expensive)
  const isWorseOffer = savings < 0;
  const absoluteSavings = Math.abs(savings);
  const absoluteSavingsPercentage = Math.abs(savingsPercentage);

  // Find the thread for this comparison
  const thread = (threads as any[]).find((t: any) => t.companyId === companyId);
  const threadId = thread?.id;

  const barWidthPercentage = offerPremium > 0 && currentPremium > 0 
    ? Math.min((offerPremium / currentPremium) * 100, 100)
    : 80;

  // Flatten detailed comparison for table display
  const tableRows: any[] = [];
  detailedComparison.forEach((category: any) => {
    tableRows.push({ isCategory: true, feature: category.category });
    category.rows?.forEach((row: any) => {
      tableRows.push({ ...row, isCategory: false });
    });
  });

  return (
    <DefaultPageLayout
      breadcrumbs={[
        { label: "Dine bedre tilbud", path: "/offers" },
        { label: "Sammenligning", path: location }
      ]}
      onNavigate={(path) => setLocation(path)}
      onProfileClick={() => setLocation(`/profile/${userId}`)}
      onSendInquiryClick={() => setLocation("/send-inquiry")}
    >
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-6 py-6">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6">
          <div className="flex w-full items-start gap-2 px-2 py-2">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 px-2 py-2">
              <span className="text-heading-1 font-heading-1 text-default-font">
                Sammenlign forsikrings tilbud
              </span>
              <span className="text-body font-body text-subtext-color">
                Sammenlign dit nuværende tilbud med {companyName}
              </span>
            </div>
            <Button
              variant="brand-secondary"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                if (threadId) {
                  setLocation(`/emails/${threadId}`);
                }
              }}
              disabled={!threadId}
              data-testid="button-view-messages"
            >
              Se beskeder
            </Button>
          </div>
          
          {/* Annual Cost Comparison */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Årlig omkostning sammenligning
            </span>
            <div className="flex w-full flex-col items-start gap-3">
              <div className={`flex w-full items-center justify-between rounded-lg border border-solid ${isWorseOffer ? 'border-error-200 bg-error-50' : 'border-success-200 bg-success-50'} px-6 py-4`}>
                <div className="flex items-center gap-3">
                  <IconWithBackground
                    variant={isWorseOffer ? "error" : "success"}
                    size="medium"
                    icon={isWorseOffer ? <FeatherTrendingUp /> : <FeatherPiggyBank />}
                  />
                  <div className="flex flex-col items-start gap-1">
                    <span className={`text-body-bold font-body-bold ${isWorseOffer ? 'text-error-700' : 'text-success-700'}`}>
                      {isWorseOffer ? 'Din årlige meromkostning' : 'Din årlige besparelse'}
                    </span>
                    <span className={`text-caption font-caption ${isWorseOffer ? 'text-error-600' : 'text-success-600'}`}>
                      {absoluteSavingsPercentage.toFixed(1)}% {isWorseOffer ? 'højere' : 'lavere'} omkostning
                    </span>
                  </div>
                </div>
                <span className={`text-heading-1 font-heading-1 ${isWorseOffer ? 'text-error-600' : 'text-success-600'}`}>
                  {formatCurrency(absoluteSavings)}
                </span>
              </div>
              <div className="flex w-full items-center justify-between">
                <span className="text-body-bold font-body-bold text-default-font">
                  Nuværende forsikring
                </span>
                <span className="text-heading-3 font-heading-3 text-default-font">
                  {formatCurrency(currentPremium)}/år
                </span>
              </div>
              <div className={`flex h-12 w-full flex-none items-start rounded-lg ${isWorseOffer ? 'bg-error-100' : 'bg-success-100'}`}>
                <div className={`flex h-12 items-center justify-center rounded-lg ${isWorseOffer ? 'bg-error-500' : 'bg-success-500'} px-6 py-6`} style={{ width: `${barWidthPercentage}%` }}>
                  <div className="flex grow shrink-0 basis-0 items-center justify-between">
                    <span className="text-body-bold font-body-bold text-white">
                      {isWorseOffer ? 'Det nye tilbud' : 'Din nye forsikring'}
                    </span>
                    <span className="text-heading-3 font-heading-3 text-white">
                      {formatCurrency(offerPremium)}/år
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Highlights Section */}
          {highlights.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <span className="text-heading-3 font-heading-3 text-default-font">
                {isWorseOffer ? 'Højdepunkter hvor tilbuddet er dårligere' : 'Højdepunkter hvor anbefalingen er bedre'}
              </span>
              <div className="flex w-full items-start gap-4">
                {highlights.slice(0, 4).map((highlight: any, index: number) => {
                  const IconComponent = iconMap[highlight.icon] || FeatherCheck;
                  return (
                    <div key={index} className="flex grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                      <IconWithBackground
                        variant={highlight.variant || "success"}
                        size="medium"
                        icon={<IconComponent />}
                        square={true}
                      />
                      <div className="flex flex-col items-start gap-1">
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

          {/* Detailed Comparison Table */}
          {tableRows.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Detaljeret sammenligning
              </span>
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Kategori</Table.HeaderCell>
                    <Table.HeaderCell>Nuværende</Table.HeaderCell>
                    <Table.HeaderCell>Nyt tilbud</Table.HeaderCell>
                    <Table.HeaderCell>Forskel</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {tableRows.map((item: any, index: number) => (
                  <Table.Row key={index}>
                    <Table.Cell>
                      <span className={item.isCategory ? "text-body-bold font-body-bold text-default-font" : "text-body font-body text-default-font"}>
                        {item.feature}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-default-font">
                        {item.current || ""}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-default-font">
                        {item.offer || ""}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {item.difference && !item.isCategory && (
                        <Badge variant={item.status === 'better' ? 'success' : item.status === 'worse' ? 'error' : 'neutral'}>
                          {item.difference}
                        </Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            </div>
          )}

          {/* Key Metrics */}
          {keyMetrics.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Nøgletal sammenligning
              </span>
              <div className="flex w-full flex-wrap items-start gap-4">
                {keyMetrics.map((metric: any, index: number) => {
                  const IconComponent = iconMap[metric.icon] || FeatherHome;
                  return (
                    <div key={index} className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-center gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                      <IconWithBackground 
                        size="large" 
                        icon={<IconComponent />}
                        variant={metric.variant}
                      />
                      <div className="flex w-full flex-col items-center gap-1">
                        <span className="text-caption-bold font-caption-bold text-subtext-color">
                          {metric.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-heading-2 font-heading-2 text-neutral-500">
                            {metric.current}
                          </span>
                          <FeatherArrowRight className={`text-heading-3 font-heading-3 ${metric.variant === 'error' || isWorseOffer ? 'text-error-600' : 'text-success-600'}`} />
                          <span className={`text-heading-2 font-heading-2 ${metric.variant === 'error' || isWorseOffer ? 'text-error-600' : 'text-success-600'}`}>
                            {metric.offer}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Added Benefits */}
          {addedBenefits.length > 0 && (
            <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <span className="text-heading-3 font-heading-3 text-default-font">
                {isWorseOffer ? 'Fjernet fra din forsikring' : 'Tilføjet til din forsikring'}
              </span>
              <div className="flex w-full flex-wrap items-start gap-2">
                {addedBenefits.map((benefit: any, index: number) => (
                  <Badge 
                    key={index}
                    variant={benefit.variant || "success"} 
                    icon={benefit.variant === "neutral" ? <FeatherInfo /> : <FeatherCheck />}
                  >
                    {benefit.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Missing Information Section */}
          {missingInfo && missingInfo.categories && missingInfo.categories.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Manglende Information
                  </span>
                  {(() => {
                    const totalAnswered = missingInfo.categories.reduce((sum: number, cat: any) => 
                      sum + cat.questions.filter((q: any) => q.answer).length, 0);
                    const unansweredCritical = missingInfo.categories.reduce((sum: number, cat: any) => 
                      sum + cat.questions.filter((q: any) => q.severity === 'critical' && !q.answer).length, 0);
                    
                    return (
                      <Badge variant="warning">
                        {unansweredCritical + missingInfo.totalImportant + missingInfo.totalQuestions - totalAnswered} punkter tilbage
                      </Badge>
                    );
                  })()}
                </div>
                <span className="text-body font-body text-subtext-color">
                  Nogle punkter er afklaret, andre afventer stadig svar
                </span>
              </div>
              <div className="flex w-full flex-col items-start gap-4">
                {missingInfo.categories.map((category: any, catIndex: number) => (
                  <div key={catIndex} className="flex w-full flex-col items-start gap-3">
                    <div className="flex w-full items-center gap-2">
                      <IconWithBackground
                        variant="neutral"
                        size="small"
                        icon={iconMap[category.icon] ? React.createElement(iconMap[category.icon]) : <FeatherHelpCircle />}
                      />
                      <span className="text-body-bold font-body-bold text-default-font">
                        {category.name}
                      </span>
                      {(() => {
                        const selectedCount = category.questions.filter((q: any) => selectedQuestionIds.includes(q.id)).length;
                        const answeredCount = category.questions.filter((q: any) => q.answer).length;
                        const criticalUnanswered = category.questions.filter((q: any) => q.severity === 'critical' && !q.answer).length;
                        
                        return (
                          <>
                            {selectedCount > 0 && (
                              <Badge variant="success">{selectedCount} valgt</Badge>
                            )}
                            {criticalUnanswered > 0 && (
                              <Badge variant="error">{criticalUnanswered} Kritisk</Badge>
                            )}
                            {answeredCount > 0 && (
                              <Badge variant="neutral">{answeredCount} besvaret</Badge>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {category.questions.map((question: any, qIndex: number) => {
                      const isSelected = selectedQuestionIds.includes(question.id);
                      const hasAnswer = !!question.answer;
                      const needsAddressing = (question.severity === 'critical' || question.severity === 'important') && !hasAnswer;
                      
                      // Determine visual status
                      let borderClass = 'border border-solid border-neutral-200 bg-neutral-50';
                      let iconColor = 'text-neutral-600';
                      let IconComponent = FeatherCheckSquare;
                      
                      if (isSelected) {
                        borderClass = 'border-2 border-solid border-success-400 bg-neutral-50';
                        iconColor = 'text-success-600';
                        IconComponent = FeatherCheckSquare;
                      } else if (hasAnswer) {
                        borderClass = 'border border-solid border-neutral-200 bg-neutral-100';
                        iconColor = 'text-neutral-600';
                        IconComponent = FeatherCheckSquare;
                      } else if (needsAddressing) {
                        borderClass = 'border border-solid border-neutral-200 bg-neutral-50';
                        iconColor = 'text-error-600';
                        IconComponent = FeatherSquare;
                      }

                      return (
                        <div 
                          key={qIndex} 
                          className={`flex w-full items-start gap-3 rounded-md px-4 py-4 cursor-pointer ${borderClass}`}
                          onClick={() => toggleQuestionSelection(question.id)}
                          data-testid={`question-${question.id}`}
                        >
                          <IconComponent className={`text-body font-body ${iconColor} mt-0.5`} />
                          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                            {hasAnswer ? (
                              <>
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-body-bold font-body-bold text-default-font">
                                    {question.question}
                                  </span>
                                  {question.explanation && (
                                    <span className="text-caption font-caption text-subtext-color">
                                      {question.explanation}
                                    </span>
                                  )}
                                </div>
                                <div className="flex w-full flex-col items-start gap-1 rounded-md border border-solid border-neutral-200 bg-white px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-caption-bold font-caption-bold text-neutral-700">
                                      {companyName} svarede
                                    </span>
                                    <span className="text-caption font-caption text-subtext-color">
                                      {new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })} kl. {new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <span className="text-body font-body text-default-font">
                                    {question.answer}
                                  </span>
                                </div>
                              </>
                            ) : question.severity !== 'question' ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-body-bold font-body-bold text-default-font">
                                  {question.question}
                                </span>
                                {question.explanation && (
                                  <span className="text-caption font-caption text-subtext-color">
                                    {question.explanation}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-body font-body text-default-font">
                                {question.question}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {catIndex < missingInfo.categories.length - 1 && (
                      <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-200" />
                    )}
                  </div>
                ))}
              </div>
              {(() => {
                const unansweredCritical = missingInfo.categories.reduce((sum: number, cat: any) => 
                  sum + cat.questions.filter((q: any) => q.severity === 'critical' && !q.answer).length, 0);
                
                return unansweredCritical > 0 ? (
                  <div className="flex w-full items-center gap-2 rounded-md bg-neutral-100 px-4 py-3">
                    <FeatherAlertCircle className="text-body font-body text-neutral-600" />
                    <span className="text-caption font-caption text-neutral-700">
                      {unansweredCritical} kritiske punkter kræver stadig afklaring
                    </span>
                  </div>
                ) : null;
              })()}
              <Button
                className="h-10 w-full flex-none"
                size="large"
                icon={<FeatherSend />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  sendQuestionsMutation.mutate(selectedQuestionIds);
                }}
                disabled={selectedQuestionIds.length === 0 || sendQuestionsMutation.isPending}
                data-testid="button-send-questions"
              >
                {sendQuestionsMutation.isPending 
                  ? 'Sender...' 
                  : `Send til selskabet (${selectedQuestionIds.length} valgt)`}
              </Button>
            </div>
          )}

          {/* Cumulative Savings Chart - Only show for better offers */}
          {!isWorseOffer && cumulativeSavings && cumulativeSavings.chartData && (
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
                  {formatCurrency(cumulativeSavings.tenYear)} over 10 år
                </Badge>
              </div>
              <AreaChart
                categories={["Besparelse"]}
                data={cumulativeSavings.chartData.map((item: any) => ({
                  year: item.year,
                  Besparelse: item.savings
                }))}
                index="year"
              />
              <div className="flex w-full flex-wrap items-start gap-4">
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
                  <span className="text-caption font-caption text-subtext-color">
                    Månedlig besparelse
                  </span>
                  <span className="text-heading-2 font-heading-2 text-success-600">
                    {formatCurrency(cumulativeSavings.monthly)}/md
                  </span>
                </div>
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
                  <span className="text-caption font-caption text-subtext-color">
                    Total efter 12 måneder
                  </span>
                  <span className="text-heading-2 font-heading-2 text-success-600">
                    {formatCurrency(cumulativeSavings.yearly)} spart
                  </span>
                </div>
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
                  <span className="text-caption font-caption text-subtext-color">
                    Forventet efter 10 år
                  </span>
                  <span className="text-heading-2 font-heading-2 text-success-600">
                    {formatCurrency(cumulativeSavings.tenYear)} spart
                  </span>
                </div>
              </div>
              <div className="flex w-full items-center gap-2 rounded-md bg-success-50 px-4 py-3">
                <FeatherPiggyBank className="text-body font-body text-success-700" />
                <span className="text-body font-body text-default-font">
                  Vi låser ind når priserne dykker og maksimerer din besparelse
                </span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex w-full flex-col items-center gap-4 border-t border-solid border-neutral-border py-6">
            <Button
              className="h-10 w-full flex-none"
              size="large"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                if (threadId) {
                  setLocation(`/emails/${threadId}`);
                }
              }}
              data-testid="button-choose-company"
            >
              Vælg og skift til {companyName}
            </Button>
            <span className="text-body font-body text-subtext-color">
              Sikker data. Du kan til enhver tid annullere før aktivering.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
