import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Badge } from "@/ui";
import { Button } from "@/ui";
import { IconWithBackground } from "@/ui";
import { Table } from "@/ui";
import { DefaultPageLayout } from "@/ui";
import { 
  FeatherArrowLeft,
  FeatherArrowRight,
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
  FeatherMessageCircle
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
};

export default function Comparison() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <DefaultPageLayout>
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
      <DefaultPageLayout>
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
  const monthlySavings = savings / 12;
  const companyName = (comparison as any).company?.name || 'Ukendt selskab';
  const highlights = comparisonData.highlights || [];
  const detailedComparison = comparisonData.detailedComparison || [];
  const keyMetrics = comparisonData.keyMetrics || [];
  const addedBenefits = comparisonData.addedBenefits || [];

  // Find the thread for this comparison
  const thread = (threads as any[]).find((t: any) => t.companyId === companyId);
  const threadId = thread?.id;

  const barWidthPercentage = offerPremium > 0 && currentPremium > 0 
    ? Math.min((offerPremium / currentPremium) * 100, 100)
    : 80;

  return (
    <DefaultPageLayout>
      <div className="flex w-full items-center justify-center bg-default-background px-6 py-6">
        <div className="flex w-full max-w-[1024px] flex-none flex-col items-start gap-6 px-2 py-2">
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Sammenlign forsikrings tilbud
            </span>
            <span className="text-body font-body text-subtext-color">
              Sammenlign dit nuværende tilbud med {companyName}
            </span>
          </div>
          
          {/* Annual Cost Comparison */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Årlig omkostning sammenligning
            </span>
            <div className="flex w-full flex-col items-start gap-3">
              <div className="flex w-full items-center justify-between rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <IconWithBackground
                    variant="success"
                    size="medium"
                    icon={<FeatherPiggyBank />}
                  />
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-success-700">
                      Din årlige besparelse
                    </span>
                    <span className="text-caption font-caption text-success-600">
                      {savingsPercentage.toFixed(1)}% lavere omkostning
                    </span>
                  </div>
                </div>
                <span className="text-heading-1 font-heading-1 text-success-600">
                  {formatCurrency(savings)}
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
              <div className="flex h-12 w-full flex-none items-start rounded-lg bg-success-100">
                <div className="flex h-12 items-center justify-center rounded-lg bg-success-500 px-6 py-6" style={{ width: `${barWidthPercentage}%` }}>
                  <div className="flex grow shrink-0 basis-0 items-center justify-between">
                    <span className="text-body-bold font-body-bold text-white">
                      Din nye forsikring
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
                Højdepunkter hvor anbefalingen er bedre
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
          {detailedComparison.length > 0 && (
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
                {detailedComparison.map((item: any, index: number) => (
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
                      {item.difference && (
                        <Badge variant={item.differenceVariant || "neutral"}>
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
                            {metric.currentValue}
                          </span>
                          <FeatherArrowRight className="text-heading-3 font-heading-3 text-success-600" />
                          <span className="text-heading-2 font-heading-2 text-success-600">
                            {metric.newValue}
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
                Tilføjet til din forsikring
              </span>
              <div className="flex w-full flex-wrap items-start gap-2">
                {addedBenefits.map((benefit: any, index: number) => (
                  <Badge 
                    key={index}
                    variant={benefit.variant || "success"} 
                    icon={benefit.variant === "neutral" ? <FeatherInfo /> : <FeatherCheck />}
                  >
                    {benefit.name}
                  </Badge>
                ))}
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
