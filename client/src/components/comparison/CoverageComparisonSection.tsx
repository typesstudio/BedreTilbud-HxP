import { Badge } from "@/ui/components/Badge";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import {
  FeatherAlertCircle,
  FeatherAlertTriangle,
  FeatherCheck,
  FeatherCheckCircle,
} from "@subframe/core";
import type { ComparisonViewModel, ComparisonCoverageRowView } from "@/utils/transformComparison";

interface StrengthWeakness {
  title: string;
  description: string;
}

interface CoverageComparisonSectionProps {
  viewModel: ComparisonViewModel;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount)) + " kr";
}

function getPolicyTypeLabel(policyType: string): string {
  const labels: Record<string, string> = {
    indbo: "Indbo",
    hus: "Hus",
    fritidshus: "Fritidshus",
    ulykke: "Ulykke",
    bil: "Bil",
    rejse: "Rejse",
  };
  return labels[policyType] || policyType.charAt(0).toUpperCase() + policyType.slice(1);
}

function deriveStrengthsWeaknesses(viewModel: ComparisonViewModel): {
  offerStrengths: StrengthWeakness[];
  offerWeaknesses: StrengthWeakness[];
  currentStrengths: StrengthWeakness[];
  currentWeaknesses: StrengthWeakness[];
} {
  const offerStrengths: StrengthWeakness[] = [];
  const offerWeaknesses: StrengthWeakness[] = [];
  const currentStrengths: StrengthWeakness[] = [];
  const currentWeaknesses: StrengthWeakness[] = [];

  const totalSavings = viewModel.overall.annualSavings;
  const offerCompany = viewModel.offerCompanyName;
  const currentCompany = viewModel.currentCompanyName;

  if (totalSavings > 0) {
    offerStrengths.push({
      title: "Billigere pris",
      description: `${formatCurrency(totalSavings)} årligt billigere`,
    });
    currentWeaknesses.push({
      title: "Dyrere pris",
      description: `${formatCurrency(totalSavings)} dyrere om året`,
    });
  } else if (totalSavings < 0) {
    offerWeaknesses.push({
      title: "Højere pris",
      description: `${formatCurrency(totalSavings)} dyrere om året`,
    });
    currentStrengths.push({
      title: "Billigere pris",
      description: `${formatCurrency(totalSavings)} billigere om året`,
    });
  }

  viewModel.policies.forEach((policy) => {
    const savings = policy.savingsAnnual ?? 0;
    const policyLabel = getPolicyTypeLabel(policy.policyType);

    if (savings > 100) {
      offerStrengths.push({
        title: `Billigere ${policyLabel}`,
        description: `${formatCurrency(savings)} besparelse årligt`,
      });
    } else if (savings < -100) {
      offerWeaknesses.push({
        title: `Dyrere ${policyLabel}`,
        description: `${formatCurrency(Math.abs(savings))} mere om året`,
      });
    }
  });

  const coverageRows = viewModel.coverageRows || [];

  coverageRows.forEach((row: ComparisonCoverageRowView) => {
    if (row.offerVariant === "success" && row.currentVariant !== "success") {
      if (offerStrengths.length < 5) {
        offerStrengths.push({
          title: row.coverageLabel,
          description: row.offerValue || "Inkluderet",
        });
      }
      if (currentWeaknesses.length < 5) {
        currentWeaknesses.push({
          title: row.coverageLabel,
          description: row.currentValue || "Ikke inkluderet",
        });
      }
    } else if (row.currentVariant === "success" && row.offerVariant !== "success") {
      if (currentStrengths.length < 5) {
        currentStrengths.push({
          title: row.coverageLabel,
          description: row.currentValue || "Inkluderet",
        });
      }
      if (offerWeaknesses.length < 5) {
        offerWeaknesses.push({
          title: row.coverageLabel,
          description: row.offerValue || "Ikke inkluderet",
        });
      }
    }
  });

  return {
    offerStrengths: offerStrengths.slice(0, 4),
    offerWeaknesses: offerWeaknesses.slice(0, 4),
    currentStrengths: currentStrengths.slice(0, 4),
    currentWeaknesses: currentWeaknesses.slice(0, 4),
  };
}

export function CoverageComparisonSection({ viewModel }: CoverageComparisonSectionProps) {
  const { offerStrengths, offerWeaknesses, currentStrengths, currentWeaknesses } = 
    deriveStrengthsWeaknesses(viewModel);

  const offerPremium = viewModel.overall.totalOfferAnnual;
  const currentPremium = viewModel.overall.totalCurrentAnnual;

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6" data-testid="coverage-comparison-section">
      <span className="text-heading-2 font-heading-2 text-default-font">
        Dækningssammenligning
      </span>
      <div className="flex w-full items-start gap-4 mobile:flex-col">
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 flex-none rounded-md bg-brand-100 flex items-center justify-center">
                <span className="text-brand-600 text-sm font-bold">
                  {viewModel.offerCompanyName.charAt(0)}
                </span>
              </div>
              <span className="text-heading-3 font-heading-3 text-default-font">
                {viewModel.offerCompanyName} Tilbud
              </span>
            </div>
            <Badge data-testid="offer-premium-badge">{formatCurrency(offerPremium)}/år</Badge>
          </div>
          
          <div className="flex w-full flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="success"
                size="small"
                icon={<FeatherCheckCircle />}
              />
              <span className="text-body-bold font-body-bold text-success-700">
                Styrker
              </span>
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              {offerStrengths.length > 0 ? (
                offerStrengths.map((item, i) => (
                  <div key={i} className="flex w-full items-start gap-2 rounded-md border border-solid border-success-200 bg-success-50 px-3 py-3" data-testid={`offer-strength-${i}`}>
                    <FeatherCheck className="text-body font-body text-success-600 mt-0.5" />
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {item.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex w-full items-start gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 px-3 py-3">
                  <span className="text-caption font-caption text-subtext-color">
                    Ingen tydelige styrker identificeret
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex w-full flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="warning"
                size="small"
                icon={<FeatherAlertTriangle />}
              />
              <span className="text-body-bold font-body-bold text-warning-700">
                Svagheder
              </span>
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              {offerWeaknesses.length > 0 ? (
                offerWeaknesses.map((item, i) => (
                  <div key={i} className="flex w-full items-start gap-2 rounded-md border border-solid border-warning-200 bg-warning-50 px-3 py-3" data-testid={`offer-weakness-${i}`}>
                    <FeatherAlertCircle className="text-body font-body text-warning-600 mt-0.5" />
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {item.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex w-full items-start gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 px-3 py-3">
                  <span className="text-caption font-caption text-subtext-color">
                    Ingen tydelige svagheder identificeret
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 flex-none rounded-md bg-neutral-200 flex items-center justify-center">
                <span className="text-neutral-600 text-sm font-bold">
                  {viewModel.currentCompanyName.charAt(0)}
                </span>
              </div>
              <span className="text-heading-3 font-heading-3 text-default-font">
                Din Nuværende
              </span>
            </div>
            <Badge variant="neutral" data-testid="current-premium-badge">{formatCurrency(currentPremium)}/år</Badge>
          </div>
          
          <div className="flex w-full flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="success"
                size="small"
                icon={<FeatherCheckCircle />}
              />
              <span className="text-body-bold font-body-bold text-success-700">
                Styrker
              </span>
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              {currentStrengths.length > 0 ? (
                currentStrengths.map((item, i) => (
                  <div key={i} className="flex w-full items-start gap-2 rounded-md border border-solid border-success-200 bg-success-50 px-3 py-3" data-testid={`current-strength-${i}`}>
                    <FeatherCheck className="text-body font-body text-success-600 mt-0.5" />
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {item.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex w-full items-start gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 px-3 py-3">
                  <span className="text-caption font-caption text-subtext-color">
                    Ingen tydelige styrker identificeret
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex w-full flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="warning"
                size="small"
                icon={<FeatherAlertTriangle />}
              />
              <span className="text-body-bold font-body-bold text-warning-700">
                Svagheder
              </span>
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              {currentWeaknesses.length > 0 ? (
                currentWeaknesses.map((item, i) => (
                  <div key={i} className="flex w-full items-start gap-2 rounded-md border border-solid border-warning-200 bg-warning-50 px-3 py-3" data-testid={`current-weakness-${i}`}>
                    <FeatherAlertCircle className="text-body font-body text-warning-600 mt-0.5" />
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {item.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex w-full items-start gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 px-3 py-3">
                  <span className="text-caption font-caption text-subtext-color">
                    Ingen tydelige svagheder identificeret
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
