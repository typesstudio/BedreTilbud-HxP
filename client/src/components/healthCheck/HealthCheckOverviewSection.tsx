import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Table } from "@/ui/components/Table";
import { 
  FeatherAlertCircle, 
  FeatherAlertTriangle, 
  FeatherBuilding, 
  FeatherCar, 
  FeatherCheckCircle,
  FeatherHeart,
  FeatherHome,
  FeatherLightbulb,
  FeatherPiggyBank,
  FeatherPlane,
  FeatherScale,
  FeatherShield,
  FeatherUsers,
  FeatherX,
  FeatherSunrise,
} from "@subframe/core";
import type { 
  HealthCheckOverviewViewModel, 
  SinglePolicySummary, 
  AggregatedIssue 
} from "@/utils/transformHealthCheck";

interface HealthCheckOverviewSectionProps {
  data: HealthCheckOverviewViewModel;
  onCompareClick?: () => void;
  onGetOfferClick?: () => void;
}

const policyTypeIcons: Record<string, React.ReactNode> = {
  indbo: <FeatherHome />,
  ulykke: <FeatherShield />,
  hus: <FeatherBuilding />,
  fritidshus: <FeatherSunrise />,
  bil: <FeatherCar />,
  rejse: <FeatherPlane />,
  sundhed: <FeatherHeart />,
  ansvar: <FeatherUsers />,
  retshjælp: <FeatherScale />,
};

function getRecommendationVariant(recommendation: SinglePolicySummary['recommendation']): 'success' | 'warning' | 'error' | 'neutral' {
  switch (recommendation) {
    case 'good':
      return 'success';
    case 'can_improve':
      return 'warning';
    case 'missing':
      return 'error';
    case 'pending':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function getRecommendationTextColor(recommendation: SinglePolicySummary['recommendation']): string {
  switch (recommendation) {
    case 'good':
      return 'text-success-600';
    case 'can_improve':
      return 'text-warning-600';
    case 'missing':
      return 'text-error-600';
    case 'pending':
      return 'text-subtext-color';
    default:
      return 'text-subtext-color';
  }
}

export function HealthCheckOverviewSection({
  data,
  onCompareClick,
  onGetOfferClick,
}: HealthCheckOverviewSectionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasSavings = data.totalAnnualSavings > 0;
  const warningIssues = data.aggregatedIssues.filter(i => i.severity === 'warning');
  const errorIssues = data.aggregatedIssues.filter(i => i.severity === 'error');

  return (
    <div className="flex w-full flex-col items-start gap-6">
      {/* Annual Potential Savings Card */}
      <div 
        className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:px-4 mobile:py-4"
        data-testid="overview-annual-savings-card"
      >
        <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
          Årlig potentiel besparelse
        </span>
        {hasSavings ? (
          <div className="flex w-full items-center justify-between rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4 mobile:flex-col mobile:items-start mobile:gap-3 mobile:px-4 mobile:py-3">
            <span className="text-heading-1 font-heading-1 text-success-600 mobile:text-heading-2 mobile:font-heading-2" data-testid="text-total-annual-savings">
              {formatCurrency(data.totalAnnualSavings)} kr
            </span>
            <div className="flex items-center gap-3">
              <IconWithBackground
                variant="success"
                size="medium"
                icon={<FeatherPiggyBank />}
              />
              <div className="flex flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-success-700 mobile:text-caption-bold mobile:font-caption-bold">
                  Din årlige besparelse
                </span>
                {data.totalSavingsPct != null && data.totalSavingsPct > 0 && (
                  <span className="text-caption font-caption text-success-600">
                    {data.totalSavingsPct.toFixed(1)}% lavere omkostning
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full items-center justify-center rounded-lg border border-solid border-neutral-200 bg-neutral-50 px-6 py-6">
            <span className="text-body font-body text-subtext-color text-center">
              Besparelsesberegning kræver en nuværende forsikring til sammenligning
            </span>
          </div>
        )}
      </div>

      {/* Coverage Status Table */}
      <div className="flex w-full flex-col items-start gap-4" data-testid="coverage-status-section">
        <div className="flex w-full items-center justify-between mobile:flex-col mobile:items-start mobile:gap-2">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Din dækningsstatus
          </span>
          <Badge variant={data.goodCount === data.totalCount ? "success" : "warning"} icon={<FeatherCheckCircle />}>
            {data.goodCount} af {data.totalCount} policer godkendt
          </Badge>
        </div>
        <div className="flex w-full flex-col items-start rounded-lg border border-solid border-neutral-border bg-default-background overflow-x-auto">
          <Table
            header={
              <Table.HeaderRow>
                <Table.HeaderCell>Dækningstype</Table.HeaderCell>
                <Table.HeaderCell>Nuværende sum</Table.HeaderCell>
                <Table.HeaderCell>Anbefaling</Table.HeaderCell>
              </Table.HeaderRow>
            }
          >
            {data.coverageStatus.map((policy) => (
              <Table.Row key={policy.policyId} data-testid={`coverage-row-${policy.policyType}`}>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                      variant={getRecommendationVariant(policy.recommendation)}
                      size="small"
                      icon={policyTypeIcons[policy.policyType] || <FeatherShield />}
                    />
                    <span className={`whitespace-nowrap text-body-bold font-body-bold ${
                      policy.recommendation === 'missing' || policy.recommendation === 'pending' 
                        ? 'text-subtext-color' 
                        : 'text-default-font'
                    }`}>
                      {policy.policyLabel}
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className={`whitespace-nowrap text-body font-body ${
                    policy.recommendation === 'missing' || policy.recommendation === 'pending'
                      ? 'text-subtext-color'
                      : 'text-default-font'
                  }`}>
                    {policy.coverageAmountLabel}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className={`whitespace-nowrap text-body font-body ${getRecommendationTextColor(policy.recommendation)}`}>
                    {policy.recommendationLabel}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        </div>
      </div>

      {/* Improvement Areas */}
      {data.aggregatedIssues.length > 0 && (
        <div 
          className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:px-4 mobile:py-4"
          data-testid="improvement-areas-section"
        >
          <span className="text-heading-2 font-heading-2 text-default-font">
            Hvor du kan forbedre dig
          </span>
          <div className="flex w-full flex-col items-start gap-3">
            {/* Warning Issues */}
            {warningIssues.length > 0 && (
              <div className="flex w-full flex-col items-start gap-3">
                <div className="flex items-center gap-2">
                  <IconWithBackground
                    variant="warning"
                    size="small"
                    icon={<FeatherAlertTriangle />}
                  />
                  <span className="text-body-bold font-body-bold text-warning-700">
                    Forbedringsmuligheder
                  </span>
                </div>
                <div className="flex w-full flex-col items-start gap-2">
                  {warningIssues.map((issue) => (
                    <div 
                      key={issue.id}
                      className="flex w-full items-start gap-2 rounded-md border border-solid border-warning-200 bg-warning-50 px-3 py-3"
                      data-testid={`warning-issue-${issue.id}`}
                    >
                      <FeatherAlertCircle className="text-body font-body text-warning-600 mt-0.5 flex-shrink-0" />
                      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {issue.title}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {issue.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Issues */}
            {errorIssues.length > 0 && (
              <div className="flex w-full flex-col items-start gap-3">
                <div className="flex items-center gap-2">
                  <IconWithBackground
                    variant="error"
                    size="small"
                    icon={<FeatherX />}
                  />
                  <span className="text-body-bold font-body-bold text-error-700">
                    Manglende dækninger
                  </span>
                </div>
                <div className="flex w-full flex-col items-start gap-2">
                  {errorIssues.map((issue) => (
                    <div 
                      key={issue.id}
                      className="flex w-full items-start gap-2 rounded-md border border-solid border-error-200 bg-error-50 px-3 py-3"
                      data-testid={`error-issue-${issue.id}`}
                    >
                      <FeatherX className="text-body font-body text-error-600 mt-0.5 flex-shrink-0" />
                      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {issue.title}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {issue.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Helpful tip */}
          <div className="flex w-full items-center gap-2 rounded-md bg-brand-100 px-4 py-3">
            <FeatherLightbulb className="text-body font-body text-brand-700 flex-shrink-0" />
            <span className="text-caption font-caption text-brand-700">
              Vi kan hjælpe dig med at få bedre dækning til en lavere pris
            </span>
          </div>
        </div>
      )}

      {/* CTA Footer */}
      <div className="flex w-full flex-col items-center gap-4 border-t border-solid border-neutral-border py-6">
        <Button
          className="h-10 w-full flex-none"
          variant="brand-primary"
          size="large"
          onClick={onGetOfferClick}
          data-testid="button-get-better-offer-overview"
        >
          Få bedre tilbud nu
        </Button>
        <span className="text-body font-body text-subtext-color">
          Gratis og uforpligtende. Ingen binding.
        </span>
      </div>
    </div>
  );
}
