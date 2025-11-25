import { Badge, Button, IconButton, IconWithBackground, AreaChart, Table } from "@/ui";
import {
  FeatherPiggyBank,
  FeatherCheck,
  FeatherAlertCircle,
  FeatherCopy,
  FeatherDollarSign,
  FeatherShield,
  FeatherClock,
  FeatherHelpCircle,
  FeatherLightbulb,
  FeatherSend,
  FeatherSquare,
} from "@subframe/core";

export interface CoverageItem {
  id: string;
  coverage: string;
  description?: string;
  value?: string;
  status?: "success" | "neutral" | "warning" | "error";
  attributes?: {
    selvrisiko?: string;
    sum?: string;
    [key: string]: any;
  };
}

export interface StrengthWeaknessItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  variant?: "success" | "warning" | "error" | "neutral";
}

export interface MissingInfoItem {
  id: string;
  category: string;
  question: string;
  icon?: string;
  variant?: "error" | "warning" | "neutral";
}

export interface CumulativeSavings {
  chartData: { month: string; savings: number }[];
  after12Months: number;
  after10Years: number;
  monthlyRange?: {
    min: number;
    max: number;
  };
}

export interface HealthCheckLayoutProps {
  title: string;
  subtitle?: string;

  companyName: string;
  policyTypeLabel: string;
  kind: "current" | "offer";

  // Quick status
  quickStatus?: {
    savingsAnnual: number;
    savingsPercentage?: number;
  };

  // Insurance details (table format)
  insuranceDetails?: {
    label: string;
    value: string | number;
    variant?: "success" | "neutral" | "warning";
  }[];

  // What's included
  whatsIncluded?: CoverageItem[];

  // Strengths and weaknesses
  strengths?: StrengthWeaknessItem[];
  weaknesses?: StrengthWeaknessItem[];

  // Cumulative savings
  cumulativeSavings?: CumulativeSavings;

  // Missing information
  missingInfo?: MissingInfoItem[];

  // Actions
  onSendQuestions?: () => void;
  onDiscussWithCompany?: () => void;
}

export function HealthCheckLayout(props: HealthCheckLayoutProps) {
  const {
    title,
    subtitle,
    companyName,
    policyTypeLabel,
    kind,
    quickStatus,
    insuranceDetails,
    whatsIncluded,
    strengths,
    weaknesses,
    cumulativeSavings,
    missingInfo,
    onSendQuestions,
    onDiscussWithCompany,
  } = props;

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "N/A";
    return (
      new Intl.NumberFormat("da-DK", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount) + " kr"
    );
  };

  return (
    <div className="flex w-full max-w-[768px] flex-col items-start gap-6">
      {/* Header */}
      <div className="flex w-full items-start gap-2 px-2 py-2">
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 px-2 py-2">
          <span className="text-heading-1 font-heading-1 text-default-font">{title}</span>
          {subtitle && (
            <span className="text-body font-body text-subtext-color">{subtitle}</span>
          )}
        </div>
        {kind === "offer" && (
          <Badge variant="brand" data-testid="badge-offer-type">
            {companyName}
          </Badge>
        )}
      </div>

      {/* Quick Status - Annual Savings */}
      {quickStatus && quickStatus.savingsAnnual > 0 && (
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Årlig potentiel besparelse
          </span>
          <div className="flex w-full items-center justify-between rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4">
            <span className="text-heading-1 font-heading-1 text-success-600" data-testid="text-annual-savings">
              {formatCurrency(quickStatus.savingsAnnual)}
            </span>
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
                {quickStatus.savingsPercentage != null && (
                  <span className="text-caption font-caption text-success-600">
                    {quickStatus.savingsPercentage}% lavere omkostning
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insurance Details Table */}
      {insuranceDetails && insuranceDetails.length > 0 && (
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Dine forsikringsdetaljer
          </span>
          <div className="flex w-full flex-col items-start">
            {insuranceDetails.map((detail, index) => (
              <div
                key={index}
                className="flex w-full items-center justify-between border-b border-solid border-neutral-border py-4 last:border-b-0"
                data-testid={`detail-row-${index}`}
              >
                <span className="text-body font-body text-subtext-color">{detail.label}</span>
                <Badge variant={detail.variant || "neutral"}>{detail.value}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What's Included */}
      {whatsIncluded && whatsIncluded.length > 0 && (
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Hvad er inkluderet
          </span>
          <div className="flex w-full flex-col items-start">
            {whatsIncluded.map((item, index) => {
              // Determine badge content based on actual data structure
              let displayValue: string;
              let badgeVariant: "success" | "neutral" | "warning" | "error" = "success";

              if (item.value === "ikke inkluderet") {
                displayValue = "ikke inkluderet";
                badgeVariant = item.status || "neutral";
              } else if (item.attributes?.selvrisiko) {
                displayValue = `Selvrisiko: ${item.attributes.selvrisiko}`;
                badgeVariant = item.status || "warning";
              } else if (item.attributes?.sum) {
                displayValue = item.attributes.sum;
                badgeVariant = item.status || "success";
              } else {
                displayValue = "inkluderet";
                badgeVariant = item.status || "success";
              }

              return (
                <div
                  key={item.id}
                  className="flex w-full items-center gap-4 border-b border-solid border-neutral-border py-4 last:border-b-0"
                  data-testid={`coverage-${index}`}
                >
                  <div className="flex grow flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      {item.coverage}
                    </span>
                    {item.description && (
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    <Badge variant={badgeVariant}>{displayValue}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {((strengths && strengths.length > 0) || (weaknesses && weaknesses.length > 0)) && (
        <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Styrker & svagheder
          </span>

          {/* Strengths */}
          {strengths && strengths.length > 0 && (
            <div className="flex w-full flex-col items-start gap-3">
              <div className="flex items-center gap-2">
                <IconWithBackground
                  variant="success"
                  size="small"
                  icon={<FeatherCheck />}
                />
                <span className="text-body-bold font-body-bold text-default-font">
                  Styrker
                </span>
              </div>
              <div className="flex w-full flex-col items-start gap-2">
                {strengths.map((item) => (
                  <div
                    key={item.id}
                    className="flex w-full flex-col items-start gap-1 rounded-md border border-solid border-success-200 bg-success-50 px-4 py-3"
                    data-testid={`strength-${item.id}`}
                  >
                    <span className="text-body-bold font-body-bold text-default-font">
                      {item.title}
                    </span>
                    <span className="text-body font-body text-default-font">
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {weaknesses && weaknesses.length > 0 && (
            <div className="flex w-full flex-col items-start gap-3">
              <div className="flex items-center gap-2">
                <IconWithBackground
                  variant="warning"
                  size="small"
                  icon={<FeatherAlertCircle />}
                />
                <span className="text-body-bold font-body-bold text-default-font">
                  Forbedringsmuligheder
                </span>
              </div>
              <div className="flex w-full flex-col items-start gap-2">
                {weaknesses.map((item) => (
                  <div
                    key={item.id}
                    className="flex w-full flex-col items-start gap-1 rounded-md border border-solid border-warning-200 bg-warning-50 px-4 py-3"
                    data-testid={`weakness-${item.id}`}
                  >
                    <span className="text-body-bold font-body-bold text-default-font">
                      {item.title}
                    </span>
                    <span className="text-body font-body text-default-font">
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cumulative Savings Chart */}
      {cumulativeSavings && cumulativeSavings.chartData.length > 0 && (
        <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-2">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Kumulativ besparelse
              </span>
              <span className="text-body font-body text-subtext-color">
                Se din besparelse over tid
              </span>
            </div>
          </div>

          <div className="flex w-full min-h-[300px] items-center justify-center">
            <AreaChart
              className="h-full w-full"
              data={cumulativeSavings.chartData}
              categories={["savings"]}
              index="month"
              colors={["teal"]}
            />
          </div>

          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex flex-col items-start gap-1">
              <span className="text-caption font-caption text-subtext-color">
                Månedlig besparelse
              </span>
              <span className="text-body-bold font-body-bold text-default-font">
                {cumulativeSavings.monthlyRange
                  ? `${formatCurrency(cumulativeSavings.monthlyRange.min)} - ${formatCurrency(cumulativeSavings.monthlyRange.max)}`
                  : "N/A"}
              </span>
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="text-caption font-caption text-subtext-color">
                Besparelse på 12 måneder
              </span>
              <span className="text-body-bold font-body-bold text-default-font">
                {formatCurrency(cumulativeSavings.after12Months)}
              </span>
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="text-caption font-caption text-subtext-color">
                Forventet besparelse om 10 år
              </span>
              <span className="text-body-bold font-body-bold text-success-700">
                {formatCurrency(cumulativeSavings.after10Years)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Missing Information */}
      {missingInfo && missingInfo.length > 0 && (
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center justify-between">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Manglende information
            </span>
            <Badge variant="neutral" icon={<FeatherCopy />}>
              Vælg alle
            </Badge>
          </div>
          <span className="text-body font-body text-subtext-color">
            Vi har fundet punkter der mangler tydelig dokumentation
          </span>
          <div className="flex w-full flex-col items-start gap-3">
            {missingInfo.map((item) => {
              const iconVariant = item.variant || "error";
              let Icon = FeatherDollarSign;
              if (item.category.toLowerCase().includes("dækning")) {
                Icon = FeatherShield;
              } else if (item.category.toLowerCase().includes("skadebehandling")) {
                Icon = FeatherClock;
              } else if (item.category.toLowerCase().includes("selvrisiko")) {
                Icon = FeatherHelpCircle;
              }

              return (
                <div
                  key={item.id}
                  className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                  data-testid={`missing-info-${item.id}`}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconWithBackground
                        variant={iconVariant}
                        size="small"
                        icon={<Icon />}
                      />
                      <span className="text-body-bold font-body-bold text-default-font">
                        {item.category}
                      </span>
                    </div>
                    <IconButton
                      size="small"
                      icon={<FeatherSquare />}
                      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                      data-testid={`button-select-question-${item.id}`}
                    />
                  </div>
                  <span className="text-body font-body text-default-font">{item.question}</span>
                </div>
              );
            })}
          </div>
          <div className="flex w-full items-center gap-2 rounded-md bg-brand-100 px-4 py-3">
            <FeatherLightbulb className="text-body font-body text-brand-700" />
            <span className="text-caption font-caption text-brand-700">
              Tip: Send alle spørgsmål på én gang for at få et komplet overblik
            </span>
          </div>
          {onSendQuestions && (
            <Button
              className="h-10 w-full flex-none"
              size="large"
              icon={<FeatherSend />}
              onClick={onSendQuestions}
              data-testid="button-send-questions"
            >
              Send alle spørgsmål til {companyName}
            </Button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {onDiscussWithCompany && (
        <Button
          className="w-full"
          size="large"
          onClick={onDiscussWithCompany}
          data-testid="button-discuss-with-company"
        >
          Diskutér og bekræft med {companyName}
        </Button>
      )}
    </div>
  );
}
