import { ComparisonOverallView, formatCurrency } from "@/utils/transformComparison";

interface ComparisonSummaryRowProps {
  overall: ComparisonOverallView;
  currentCompanyName: string;
  offerCompanyName: string;
}

export function ComparisonSummaryRow({
  overall,
  currentCompanyName,
  offerCompanyName,
}: ComparisonSummaryRowProps) {
  const savingsPercentLabel = overall.savingsPercent != null
    ? `${overall.savingsPercent.toFixed(1)}% billigere`
    : "";

  return (
    <div className="flex w-full items-start gap-4 flex-wrap" data-testid="comparison-summary-cards">
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-50 px-6 py-6" data-testid="card-savings">
        <span className="text-body-bold font-body-bold text-neutral-600">
          Samlet besparelse
        </span>
        <span className="text-heading-1 font-heading-1 text-success-600" data-testid="text-total-savings">
          {formatCurrency(overall.annualSavings)}
        </span>
        <span className="text-caption font-caption text-subtext-color" data-testid="text-savings-percent">
          {savingsPercentLabel}
        </span>
      </div>
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6" data-testid="card-offer">
        <span className="text-body-bold font-body-bold text-neutral-600">
          {offerCompanyName} tilbud
        </span>
        <span className="text-heading-1 font-heading-1 text-default-font" data-testid="text-offer-premium">
          {formatCurrency(overall.totalOfferAnnual)}
        </span>
        <span className="text-caption font-caption text-subtext-color">
          Per år
        </span>
      </div>
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6" data-testid="card-current">
        <span className="text-body-bold font-body-bold text-neutral-600">
          Din nuværende ({currentCompanyName})
        </span>
        <span className="text-heading-1 font-heading-1 text-default-font" data-testid="text-current-premium">
          {formatCurrency(overall.totalCurrentAnnual)}
        </span>
        <span className="text-caption font-caption text-subtext-color">
          Per år
        </span>
      </div>
    </div>
  );
}
