import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Badge } from "../../../src/ui/components/Badge";
import { Button } from "../../../src/ui/components/Button";
import { IconWithBackground } from "../../../src/ui/components/IconWithBackground";
import { AreaChart } from "../../../src/ui/components/AreaChart";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { 
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
  FeatherCheck,
  FeatherInfo,
  FeatherSend,
  FeatherDollarSign,
  FeatherHelpCircle,
  FeatherSquare,
  FeatherAlertCircle,
  FeatherCheckSquare
} from "@subframe/core";

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
  const userId = localStorage.getItem("userId");

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["/api/comparisons", id],
    enabled: !!id,
  });
  const companyId = (comparison as any)?.companyId;
  
  const { data: threadsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/emails/threads", userId],
    enabled: !!userId,
  });
  const threads = threadsResponse?.data || [];

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
      <AppLayoutWithNav userId={userId!}>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-body font-body text-subtext-color">Indlæser sammenligning...</p>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  if (!comparison) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">Sammenligning ikke fundet</h2>
            <Button onClick={() => setLocation("/offers")} className="h-12 touch-target">
              Tilbage til oversigt
            </Button>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  const comparisonData = (comparison as any).comparisonData || {};
  const currentOcrData = (comparison as any).currentDocument?.ocrData || {};
  const offerOcrData = (comparison as any).offerDocument?.ocrData || {};
  const currentPremium = currentOcrData.annualPremium || 0;
  const offerPremium = offerOcrData.annualPremium || 0;
  const savings = (comparison as any).savings || 0;
  const savingsPercentage = comparisonData.savingsPercentage || 0;
  const companyName = (comparison as any).company?.name || 'Ukendt selskab';
  const currentCompanyName = currentOcrData.companyName || 'Din nuværende forsikring';
  const highlights = comparisonData.highlights || [];
  const detailedComparison = comparisonData.detailedComparison || [];
  const keyMetrics = comparisonData.keyMetrics || [];
  const addedBenefits = comparisonData.addedBenefits || [];
  const missingInfo = comparisonData.missingInfo || null;
  const cumulativeSavings = comparisonData.cumulativeSavings || null;
  
  const isWorseOffer = savings < 0;
  const absoluteSavings = Math.abs(savings);
  const absoluteSavingsPercentage = Math.abs(savingsPercentage);

  const thread = threads.find((t: any) => t.companyId === companyId);
  const threadId = thread?.id;

  const barWidthPercentage = offerPremium > 0 && currentPremium > 0 
    ? Math.min((offerPremium / currentPremium) * 100, 100)
    : 80;

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
          
          {/* Header */}
          <div className="flex w-full items-start gap-2 px-2 py-2 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-0 mobile:py-2">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 px-2 py-2 mobile:px-0 mobile:py-0">
              <span className="text-heading-1 font-heading-1 text-default-font mobile:text-heading-2 mobile:font-heading-2" data-testid="text-comparison-title">
                Sammenlign forsikrings tilbud
              </span>
              <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                Sammenlign dit nuværende tilbud med {companyName}
              </span>
            </div>
            <Button
              className="h-12 mobile:w-full touch-target"
              variant="brand-secondary"
              onClick={() => threadId && setLocation(`/emails/${threadId}`)}
              disabled={!threadId}
              data-testid="button-view-messages"
            >
              Se beskeder
            </Button>
          </div>

          {/* Annual Cost Comparison */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
            <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
              Årlig omkostning sammenligning
            </span>
            <div className="flex w-full flex-col items-start gap-3">
              <div className={`flex w-full items-center justify-between rounded-lg border border-solid px-6 py-4 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2 mobile:px-4 mobile:py-3 ${isWorseOffer ? 'border-error-200 bg-error-50' : 'border-success-200 bg-success-50'}`}>
                <div className="flex items-center gap-3">
                  <IconWithBackground
                    variant={isWorseOffer ? "error" : "success"}
                    size="medium"
                    icon={<FeatherPiggyBank />}
                  />
                  <div className="flex flex-col items-start gap-1">
                    <span className={`text-body-bold font-body-bold ${isWorseOffer ? 'text-error-700' : 'text-success-700'} mobile:text-body-bold mobile:font-body-bold`}>
                      {isWorseOffer ? 'Dyrere tilbud' : 'Din årlige besparelse'}
                    </span>
                    <span className={`text-body font-body ${isWorseOffer ? 'text-error-600' : 'text-success-600'} mobile:text-caption mobile:font-caption`}>
                      {absoluteSavingsPercentage.toFixed(1)}% {isWorseOffer ? 'dyrere' : 'billigere'}
                    </span>
                  </div>
                </div>
                <span className={`text-heading-1 font-heading-1 ${isWorseOffer ? 'text-error-600' : 'text-success-600'} mobile:text-heading-2 mobile:font-heading-2 mobile:self-end`} data-testid="text-savings-amount">
                  {formatCurrency(absoluteSavings)}
                </span>
              </div>
              <div className="flex w-full items-center justify-between">
                <span className="text-body-bold font-body-bold text-default-font mobile:text-body mobile:font-body">
                  Nuværende forsikring
                </span>
                <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-current-premium">
                  {formatCurrency(currentPremium)}/år
                </span>
              </div>
              <div className="flex h-12 w-full flex-none items-start rounded-lg bg-success-100 mobile:h-auto mobile:min-h-[48px] mobile:w-full mobile:flex-none">
                <div 
                  className={`flex h-12 items-center justify-center rounded-lg px-6 py-6 mobile:h-auto mobile:min-h-[48px] mobile:grow mobile:shrink-0 mobile:basis-0 mobile:px-4 mobile:py-3 ${isWorseOffer ? 'bg-error-500' : 'bg-success-500'}`}
                  style={{ width: `${barWidthPercentage}%` }}
                >
                  <div className="flex grow shrink-0 basis-0 items-center justify-between mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1">
                    <span className="text-body-bold font-body-bold text-white mobile:text-body mobile:font-body">
                      Din nye forsikring
                    </span>
                    <span className="text-heading-3 font-heading-3 text-white mobile:text-body-bold mobile:font-body-bold" data-testid="text-offer-premium">
                      {formatCurrency(offerPremium)}/år
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Highlights */}
          {highlights.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
              <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                {isWorseOffer ? 'Højdepunkter hvor tilbuddet er dårligere' : 'Højdepunkter hvor anbefalingen er bedre'}
              </span>
              <div className="flex w-full items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
                {highlights.slice(0, 4).map((highlight: any, index: number) => {
                  const IconComponent = iconMap[highlight.icon] || FeatherCheck;
                  return (
                    <div key={index} className="flex grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4 mobile:flex-col mobile:flex-nowrap mobile:gap-2">
                      <IconWithBackground
                        variant={highlight.variant || (isWorseOffer ? "error" : "success")}
                        size="medium"
                        icon={<IconComponent />}
                        square={true}
                      />
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-body-bold font-body-bold text-default-font mobile:text-body-bold mobile:font-body-bold">
                          {highlight.title}
                        </span>
                        <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
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
          {detailedComparison.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
              <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                Detaljeret sammenligning
              </span>
              <div className="flex w-full items-start px-6 overflow-x-auto -mx-6 mobile:px-4 mobile:py-0 mobile:overflow-x-auto mobile:-mx-4">
                <div className="flex min-w-[576px] grow shrink-0 basis-0 flex-col items-start">
                  <div className="flex w-full items-center gap-4 border-b-2 border-solid border-neutral-300 bg-neutral-50 pb-3 sticky top-0 z-10">
                    <div className="flex w-48 flex-none flex-col items-start mobile:h-auto mobile:w-32 mobile:flex-none">
                      <span className="text-caption-bold font-caption-bold text-subtext-color">
                        Dækning
                      </span>
                    </div>
                    <div className="flex grow shrink-0 basis-0 flex-col items-center">
                      <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                        Nuværende
                      </span>
                      <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                        {currentCompanyName}
                      </span>
                    </div>
                    <div className="flex grow shrink-0 basis-0 flex-col items-center">
                      <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                        Nyt tilbud
                      </span>
                      <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                        {companyName}
                      </span>
                    </div>
                  </div>
                  
                  {detailedComparison.map((category: any, catIndex: number) => (
                    <div key={catIndex} className="w-full">
                      {category.rows && category.rows.map((row: any, rowIndex: number) => (
                        <div key={`${catIndex}-${rowIndex}`} className="flex w-full items-center gap-4 border-b border-solid border-neutral-border py-4">
                          <div className="flex w-48 flex-none flex-col items-start gap-1 mobile:w-32">
                            <span className="text-body-bold font-body-bold text-default-font mobile:text-body-bold mobile:font-body-bold">
                              {row.feature}
                            </span>
                            {row.description && (
                              <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                                {row.description}
                              </span>
                            )}
                          </div>
                          <div className="flex grow shrink-0 basis-0 items-center justify-center">
                            {row.currentValue === 'inkluderet' || row.currentValue === true ? (
                              <Badge variant="success">inkluderet</Badge>
                            ) : row.currentValue === 'ikke inkluderet' || row.currentValue === false ? (
                              <Badge variant="error">ikke inkluderet</Badge>
                            ) : (
                              <Badge variant="neutral">{row.currentValue}</Badge>
                            )}
                          </div>
                          <div className="flex grow shrink-0 basis-0 items-center justify-center">
                            {row.offerValue === 'inkluderet' || row.offerValue === true ? (
                              <Badge variant="success">inkluderet</Badge>
                            ) : row.offerValue === 'ikke inkluderet' || row.offerValue === false ? (
                              <Badge variant="error">ikke inkluderet</Badge>
                            ) : (
                              <Badge variant="neutral">{row.offerValue}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics */}
          {keyMetrics.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
              <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                Nøgletal sammenligning
              </span>
              <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-row mobile:flex-nowrap mobile:gap-3">
                {keyMetrics.map((metric: any, index: number) => {
                  const IconComponent = iconMap[metric.icon] || FeatherHome;
                  return (
                    <div key={index} className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-center gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4 mobile:flex-col mobile:flex-nowrap mobile:gap-2 mobile:min-w-full">
                      <IconWithBackground 
                        variant={metric.improved ? "success" : "neutral"}
                        size="large" 
                        icon={<IconComponent />} 
                      />
                      <div className="flex w-full flex-col items-center gap-1">
                        <span className="text-caption-bold font-caption-bold text-subtext-color">
                          {metric.label}
                        </span>
                        <div className="flex items-center gap-2 mobile:flex-row mobile:flex-nowrap mobile:gap-1">
                          <span className="text-heading-2 font-heading-2 text-neutral-500 mobile:text-heading-3 mobile:font-heading-3">
                            {metric.currentValue}
                          </span>
                          <FeatherArrowRight className={`text-heading-3 font-heading-3 ${metric.improved ? 'text-success-600' : 'text-neutral-400'} mobile:text-body mobile:font-body`} />
                          <span className={`text-heading-2 font-heading-2 ${metric.improved ? 'text-success-600' : 'text-neutral-600'} mobile:text-heading-3 mobile:font-heading-3`}>
                            {metric.offerValue}
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
            <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:px-4 mobile:py-4">
              <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                Tilføjet til din forsikring
              </span>
              <div className="flex w-full items-start gap-2 flex-wrap">
                {addedBenefits.map((benefit: any, index: number) => (
                  <Badge 
                    key={index} 
                    variant={benefit.optional ? "neutral" : "success"} 
                    icon={benefit.optional ? <FeatherInfo /> : <FeatherCheck />}
                    data-testid={`badge-benefit-${index}`}
                  >
                    {benefit.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Missing Information */}
          {missingInfo && missingInfo.categories && missingInfo.categories.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
              <div className="flex w-full flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2">
                  <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                    Manglende information
                  </span>
                  <Badge variant="warning">
                    {missingInfo.totalCritical + missingInfo.totalImportant + missingInfo.totalQuestions} punkter
                  </Badge>
                </div>
                <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                  Vi har fundet punkter der mangler tydelig dokumentation
                </span>
              </div>
              
              <div className="flex w-full flex-col items-start gap-4">
                {missingInfo.categories.map((category: any, catIndex: number) => (
                  <div key={catIndex} className="flex w-full flex-col items-start gap-3">
                    <div className="flex w-full items-center gap-2">
                      <IconWithBackground
                        variant={severityColorMap[category.severity] as any || "neutral"}
                        size="small"
                        icon={iconMap[category.icon] ? <category.icon.type /> : <FeatherDollarSign />}
                      />
                      <span className="text-body-bold font-body-bold text-default-font mobile:text-body-bold mobile:font-body-bold">
                        {category.name}
                      </span>
                      {category.criticalCount > 0 && (
                        <Badge variant="error">{category.criticalCount} kritiske</Badge>
                      )}
                      {category.importantCount > 0 && (
                        <Badge variant="warning">{category.importantCount} vigtige</Badge>
                      )}
                      {category.questionCount > 0 && (
                        <Badge variant="neutral">{category.questionCount} spørgsmål</Badge>
                      )}
                    </div>
                    
                    {category.questions.map((question: any, qIndex: number) => {
                      const isSelected = selectedQuestionIds.includes(question.id);
                      const borderClass = question.severity === 'critical' 
                        ? 'border-2 border-solid border-error-600 bg-error-50'
                        : question.severity === 'important' 
                          ? 'border border-solid border-warning-200 bg-warning-50'
                          : 'border border-solid border-neutral-border bg-neutral-50';
                      const iconColor = question.severity === 'critical'
                        ? 'text-error-600'
                        : question.severity === 'important'
                          ? 'text-warning-600'
                          : 'text-neutral-400';

                      return (
                        <div 
                          key={qIndex} 
                          className={`flex w-full items-start gap-3 rounded-md px-4 py-4 cursor-pointer ${borderClass}`}
                          onClick={() => !question.answer && toggleQuestionSelection(question.id)}
                          data-testid={`question-${question.id}`}
                        >
                          {isSelected ? (
                            <FeatherCheckSquare className={`text-body font-body ${iconColor} mt-0.5`} />
                          ) : (
                            <FeatherSquare className={`text-body font-body ${iconColor} mt-0.5`} />
                          )}
                          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                            {question.answer ? (
                              <div className="flex w-full flex-col items-start gap-1 px-2 py-2">
                                <span className="text-body-bold font-body-bold text-default-font mobile:text-body-bold mobile:font-body-bold">
                                  {question.question}
                                </span>
                                {question.details && (
                                  <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                                    {question.details}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <>
                                <span className="text-body-bold font-body-bold text-default-font mobile:text-body-bold mobile:font-body-bold">
                                  {question.question}
                                </span>
                                {question.details && (
                                  <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                                    {question.details}
                                  </span>
                                )}
                              </>
                            )}
                            {question.answer && (
                              <div className="flex w-full flex-col items-start gap-1 rounded-md border border-solid border-success-300 bg-white px-3 py-2 mt-2">
                                <span className="text-caption-bold font-caption-bold text-success-700">
                                  Svar fra {companyName}
                                </span>
                                <span className="text-body font-body text-default-font mobile:text-body mobile:font-body">
                                  {question.answer}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              
              {missingInfo.totalCritical > 0 && (
                <div className="flex w-full items-center gap-2 rounded-md bg-error-50 px-4 py-3">
                  <FeatherAlertCircle className="text-body font-body text-error-600" />
                  <span className="text-body font-body text-error-700 mobile:text-caption mobile:font-caption">
                    {missingInfo.totalCritical} kritiske punkter kræver øjeblikkelig afklaring
                  </span>
                </div>
              )}
              
              <Button
                className="h-12 w-full flex-none touch-target"
                size="large"
                icon={<FeatherSend />}
                onClick={() => sendQuestionsMutation.mutate(selectedQuestionIds)}
                disabled={selectedQuestionIds.length === 0 || sendQuestionsMutation.isPending}
                data-testid="button-send-questions"
              >
                {sendQuestionsMutation.isPending 
                  ? 'Sender...' 
                  : `Send til selskabet (${selectedQuestionIds.length} valgt)`}
              </Button>
            </div>
          )}

          {/* Cumulative Savings Chart */}
          {cumulativeSavings && cumulativeSavings.chartData && (
            <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4 mobile:px-4 mobile:py-4">
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
                  {formatCurrency(cumulativeSavings.tenYearTotal || 0)} over 10 år
                </Badge>
              </div>
              <AreaChart
                className="mobile:h-64 mobile:flex-none"
                categories={cumulativeSavings.chartData.categories || ["Besparelse"]}
                data={cumulativeSavings.chartData.data || []}
                index={cumulativeSavings.chartData.index || "Måned"}
              />
              <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-row mobile:flex-wrap mobile:gap-3">
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
                  <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                    Månedlig besparelse
                  </span>
                  <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                    {formatCurrency(cumulativeSavings.monthlySavings || 0)}
                  </span>
                </div>
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
                  <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                    Total efter 12 måneder
                  </span>
                  <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                    {formatCurrency((cumulativeSavings.monthlySavings || 0) * 12)} spart
                  </span>
                </div>
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
                  <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                    Forventet efter 10 år
                  </span>
                  <span className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3">
                    {formatCurrency(cumulativeSavings.tenYearTotal || 0)} spart
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
          )}

          {/* Action Buttons */}
          <div className="flex w-full flex-col items-center gap-4 border-t border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-0 mobile:py-4">
            <Button
              className="h-12 w-full flex-none touch-target"
              size="large"
              data-testid="button-switch-insurance"
            >
              {isWorseOffer ? 'Behold nuværende forsikring' : `Skift til ${companyName}`}
            </Button>
            <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption mobile:text-center">
              Sikker data. Du kan annullere når som helst før aktivering.
            </span>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
