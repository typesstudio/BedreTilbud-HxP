import { ComparisonOverallView } from "@/utils/transformComparison";

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
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "Afventer";
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  const savingsPercentLabel = overall.savingsPercent != null
    ? `${overall.savingsPercent.toFixed(1)}%`
    : "";

  return (
    <div className="flex w-full items-start gap-4 flex-wrap">
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-50 px-6 py-6">
        <span className="text-body-bold font-body-bold text-neutral-600">
          Samlet besparelse
        </span>
        <span className="text-heading-1 font-heading-1 text-success-600">
          {formatCurrency(overall.annualSavings)}
        </span>
        <span className="text-caption font-caption text-subtext-color">
          {savingsPercentLabel} billigere
        </span>
      </div>
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
        <span className="text-body-bold font-body-bold text-neutral-600">
          {offerCompanyName} tilbud
        </span>
        <span className="text-heading-1 font-heading-1 text-default-font">
          {formatCurrency(overall.totalOfferAnnual)}
        </span>
        <span className="text-caption font-caption text-subtext-color">
          Per år
        </span>
      </div>
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-6 py-6">
        <span className="text-body-bold font-body-bold text-neutral-600">
          Din nuværende ({currentCompanyName})
        </span>
        <span className="text-heading-1 font-heading-1 text-default-font">
          {formatCurrency(overall.totalCurrentAnnual)}
        </span>
        <span className="text-caption font-caption text-subtext-color">
          Per år
        </span>
      </div>
    </div>
  );
}
