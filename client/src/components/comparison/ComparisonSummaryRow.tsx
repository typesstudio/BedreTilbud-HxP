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
  const savings = overall.annualSavings;
  const hasSavingsData = savings != null && savings !== 0;
  const isPositiveSavings = savings != null && savings > 0;
  const isNegativeSavings = savings != null && savings < 0;
  
  const getSavingsPercentLabel = () => {
    if (overall.savingsPercent == null) return "";
    if (isPositiveSavings) return `${Math.abs(overall.savingsPercent).toFixed(1)}% billigere`;
    if (isNegativeSavings) return `${Math.abs(overall.savingsPercent).toFixed(1)}% dyrere`;
    return "";
  };

  const getSavingsDisplay = () => {
    if (savings == null) return "Afventer";
    if (savings === 0) return "0 kr";
    if (isPositiveSavings) return formatCurrency(savings);
    return `-${formatCurrency(Math.abs(savings))}`;
  };

  const getCardBgClass = () => {
    if (isPositiveSavings) return 'bg-success-50';
    if (isNegativeSavings) return 'bg-error-50';
    return 'bg-neutral-50';
  };

  const getTextColorClass = () => {
    if (isPositiveSavings) return 'text-success-600';
    if (isNegativeSavings) return 'text-error-600';
    return 'text-default-font';
  };

  return (
    <div className="flex w-full items-start gap-4 flex-wrap" data-testid="comparison-summary-cards">
      <div className={`flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md px-6 py-6 ${getCardBgClass()}`} data-testid="card-savings">
        <span className="text-body-bold font-body-bold text-neutral-600">
          Samlet besparelse
        </span>
        <span className={`text-heading-1 font-heading-1 ${getTextColorClass()}`} data-testid="text-total-savings">
          {getSavingsDisplay()}
        </span>
        <span className="text-caption font-caption text-subtext-color" data-testid="text-savings-percent">
          {getSavingsPercentLabel()}
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
