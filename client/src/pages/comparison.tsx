import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Badge } from "../../../src/ui/components/Badge";
import { Button } from "../../../src/ui/components/Button";
import { IconWithBackground } from "../../../src/ui/components/IconWithBackground";
import { Table } from "../../../src/ui/components/Table";
import { DefaultPageLayout } from "../../../src/ui/layouts/DefaultPageLayout";
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
  FeatherInfo
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

  const barWidth = offerPremium > 0 && currentPremium > 0 
    ? `${Math.min((offerPremium / currentPremium) * 100, 100)}%`
    : '50%';

  return (
    <DefaultPageLayout>
      <div className="flex w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        {/* Back Button */}
        <Button
          variant="neutral"
          iconLeft={<FeatherArrowLeft />}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/offers-overview")}
          data-testid="button-back-to-offers"
        >
          Tilbage til oversigt
        </Button>

        {/* Savings Banner */}
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-success-50 px-6 py-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-2">
              <span className="text-heading-1 font-heading-1 text-success-700">
                Spar {formatCurrency(savings)} årligt
              </span>
              <span className="text-body font-body text-subtext-color">
                {formatCurrency(monthlySavings)} månedlig besparelse
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                {companyName}
              </span>
              <span className="text-body font-body text-subtext-color">
                {formatCurrency(offerPremium)} i alt om året
              </span>
            </div>
          </div>
        </div>

        {/* Annual Cost Comparison */}
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Årlig omkostning sammenligning
          </span>
          <div className="flex w-full flex-col items-start gap-6">
            <div className="flex w-full flex-col items-start gap-3">
              <div className="flex w-full items-center justify-between">
                <span className="text-body-bold font-body-bold text-default-font">
                  Nuværende forsikring
                </span>
                <span className="text-heading-3 font-heading-3 text-default-font">
                  {formatCurrency(currentPremium)}/år
                </span>
              </div>
              <div className="flex h-12 w-full flex-none items-start rounded-lg bg-success-100">
                <div 
                  className="flex h-12 items-center justify-center rounded-lg bg-success-500 px-6 py-6" 
                  style={{ width: barWidth }}
                >
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
          </div>
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Højdepunkter hvor tilbuddet er bedre
            </span>
            <div className="flex w-full items-start gap-4 flex-wrap">
              {highlights.map((highlight: any, index: number) => {
                const IconComponent = iconMap[highlight.icon] || FeatherCheck;
                return (
                  <div 
                    key={index}
                    className="flex grow shrink-0 basis-0 min-w-[200px] flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                  >
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
          <div className="flex w-full flex-col items-start gap-2 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Funktion</Table.HeaderCell>
                  <Table.HeaderCell>Nuværende</Table.HeaderCell>
                  <Table.HeaderCell>Nyt tilbud</Table.HeaderCell>
                  <Table.HeaderCell>Forskel</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {detailedComparison.map((category: any, categoryIndex: number) => (
                <>
                  <Table.Row key={`category-${categoryIndex}`}>
                    <Table.Cell>
                      <span className="text-body-bold font-body-bold text-default-font">
                        {category.category}
                      </span>
                    </Table.Cell>
                    <Table.Cell />
                    <Table.Cell />
                    <Table.Cell />
                  </Table.Row>
                  {category.rows?.map((row: any, rowIndex: number) => (
                    <Table.Row key={`row-${categoryIndex}-${rowIndex}`}>
                      <Table.Cell>
                        <span className="text-body font-body text-default-font">
                          {row.feature}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-default-font">
                          {row.current}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-default-font">
                          {row.offer}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge 
                          variant={
                            row.status === "better" ? "success" : 
                            row.status === "worse" ? "error" : 
                            "neutral"
                          }
                        >
                          {row.difference}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </>
              ))}
            </Table>
          </div>
        )}

        {/* Key Metrics */}
        {keyMetrics.length > 0 && (
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Nøgletal sammenligning
            </span>
            <div className="flex w-full flex-wrap items-start gap-4">
              {keyMetrics.map((metric: any, index: number) => {
                const IconComponent = iconMap[metric.icon] || FeatherShield;
                return (
                  <div 
                    key={index}
                    className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-center gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4"
                  >
                    <IconWithBackground 
                      variant={metric.variant || "neutral"}
                      size="large" 
                      icon={<IconComponent />} 
                    />
                    <div className="flex w-full flex-col items-center gap-1">
                      <span className="text-caption-bold font-caption-bold text-subtext-color">
                        {metric.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-heading-2 font-heading-2 text-neutral-500">
                          {metric.current}
                        </span>
                        <FeatherArrowRight className="text-heading-3 font-heading-3 text-success-600" />
                        <span className="text-heading-2 font-heading-2 text-success-600">
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
              Tilføjet til din forsikring
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

        {/* Action Buttons */}
        <div className="flex w-full flex-col sm:flex-row gap-4">
          <Button
            className="flex-1"
            iconRight={<FeatherArrowRight />}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              alert(`Skift til ${companyName} funktionalitet kommer snart!`);
            }}
            data-testid="button-accept-offer"
          >
            Jeg vil skifte til {companyName}
          </Button>
          <Button
            variant="neutral"
            className="flex-1"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              alert('Kontakt funktionalitet kommer snart!');
            }}
            data-testid="button-contact-me"
          >
            Kontakt mig for mere info
          </Button>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
