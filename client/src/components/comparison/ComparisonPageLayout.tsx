import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Table } from "@/ui/components/Table";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { ComparisonHeader } from "@/components/comparison/ComparisonHeader";
import { ComparisonTabs } from "@/components/comparison/ComparisonTabs";
import {
  FeatherHome,
  FeatherShield,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
} from "@subframe/core";

// View model types
export type ComparisonPolicyRow = {
  policyType: string;
  label: string;
  icon: any; // Component reference
  currentAnnual: number | null;
  offerAnnual: number | null;
  annualSavings: number | null;
  statusLabel?: string;
  statusVariant?: "success" | "warning" | "neutral" | "error";
};

export type ComparisonViewModel = {
  title: string;
  subtitle: string;
  currentCompanyName: string;
  offerCompanyName: string;
  totalAnnualSavings: number;
  totalSavingsPercent: number;
  totalCurrentAnnual: number;
  totalOfferAnnual: number;
  policies: ComparisonPolicyRow[];
  canOpenMessages?: boolean;
  messageCtaLabel?: string;
  canOpenHealthCheck?: boolean;
};

export type ComparisonPageLayoutProps = {
  view: ComparisonViewModel;
  onSeeMessages?: () => void;
  onSeeHealthCheck?: () => void;
  onChooseOffer?: () => void;
};

export function ComparisonPageLayout({
  view,
  onSeeMessages,
  onSeeHealthCheck,
  onChooseOffer,
}: ComparisonPageLayoutProps) {
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "Afventer";
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  const savingsPercentLabel =
    view.totalSavingsPercent != null
      ? `${view.totalSavingsPercent.toFixed(1)}%`
      : "";

  return (
    <DefaultPageLayout>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
          
          <ComparisonHeader
            title={view.title}
            subtitle={view.subtitle}
            onSeBeskederClick={onSeeMessages}
            onSeSundhedstjekClick={onSeeHealthCheck}
            showBeskederButton={view.canOpenMessages}
            showSundhedstjekButton={view.canOpenHealthCheck}
          />

          <ComparisonTabs
            selectedTab="samlet"
            onTabChange={() => {}}
          />

          {/* Summary Cards */}
          <div className="flex w-full items-start gap-4 flex-wrap">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-50 px-6 py-6">
              <span className="text-body-bold font-body-bold text-neutral-600">
                Samlet besparelse
              </span>
              <span className="text-heading-1 font-heading-1 text-success-600">
                {formatCurrency(view.totalAnnualSavings)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                {savingsPercentLabel} billigere
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
              <span className="text-body-bold font-body-bold text-neutral-600">
                {view.offerCompanyName} tilbud
              </span>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {formatCurrency(view.totalOfferAnnual)}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Per år
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
              <span className="text-body-bold font-body-bold text-neutral-600">
                Din nuværende ({view.currentCompanyName})
              </span>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {formatCurrency(view.totalCurrentAnnual)}
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
                {view.policies.map((policy) => {
                  const hasPricing = policy.currentAnnual && policy.offerAnnual;
                  const IconComponent = policy.icon;
                  return (
                    <Table.Row key={policy.policyType}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <IconWithBackground 
                            size="small" 
                            icon={<IconComponent />}
                            variant={hasPricing ? "neutral" : "warning"}
                          />
                          <span className={`whitespace-nowrap text-body-bold font-body-bold ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                            {policy.label}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`whitespace-nowrap text-body font-body ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                          {formatCurrency(policy.currentAnnual)}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`whitespace-nowrap text-body font-body ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                          {formatCurrency(policy.offerAnnual)}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`whitespace-nowrap text-body-bold font-body-bold ${hasPricing ? 'text-success-600' : 'text-subtext-color'}`}>
                          {hasPricing ? formatCurrency(policy.annualSavings) : "—"}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-subtext-color">
                          {policy.statusLabel ?? "—"}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table>
            </div>
          </div>

          {/* Call to Action */}
          {onChooseOffer && (
            <div className="flex w-full flex-col items-center gap-4 border-t border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-0 mobile:py-4">
              <Button
                className="h-10 w-full flex-none"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  onChooseOffer();
                }}
                data-testid="button-choose-offer"
              >
                Vælg dette tilbud
              </Button>
              <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption mobile:text-center">
                Sikker data. Du kan annullere når som helst før aktivering
              </span>
            </div>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}
