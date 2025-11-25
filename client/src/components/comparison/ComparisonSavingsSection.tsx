import { AreaChart } from "@/ui/components/AreaChart";
import { Badge } from "@/ui/components/Badge";
import { FeatherArrowUp } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { SavingsOverTimeView } from "@/utils/transformComparison";

interface ComparisonSavingsSectionProps {
  savings: SavingsOverTimeView;
  activePolicyKey: string | "all";
}

function formatCurrencyShort(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount)) + " kr";
}

export function ComparisonSavingsSection({ savings, activePolicyKey }: ComparisonSavingsSectionProps) {
  // Filter series based on active policy key
  const visibleSeries =
    activePolicyKey === "all"
      ? savings.series
      : savings.series.filter((s) => s.key === activePolicyKey);

  // If no visible series, don't render anything
  if (visibleSeries.length === 0) {
    return null;
  }

  // Build AreaChart categories (one per visible policy)
  const categories = visibleSeries.map((s) => s.label);

  // Build chart data - 120 monthly data points
  const data = Array.from({ length: 120 }, (_, i) => {
    const month = i + 1;
    const row: any = { Måned: `${month}` };

    visibleSeries.forEach((s) => {
      const point = s.points[i];
      row[s.label] = point?.cumulative ?? 0;
    });

    return row;
  });

  // Calculate values for the 3 cards
  let monthlySavings: number;
  let annualSavings: number;
  let tenYearSavings: number;

  if (activePolicyKey === "all") {
    // Show totals across all policies
    monthlySavings = savings.totalAnnualSavings / 12;
    annualSavings = savings.totalAnnualSavings;
    tenYearSavings = savings.totalTenYearSavings;
  } else {
    // Show values for the specific policy
    const series = visibleSeries[0];
    monthlySavings = series.monthlySavings;
    annualSavings = series.annualSavings;
    tenYearSavings = series.tenYearSavings;
  }

  // Value formatter for Y-axis (with thousand separators)
  const tickFormatter = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " kr";
  };

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4 mobile:px-4 mobile:py-4">
      <div className="flex w-full items-center justify-between mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2">
        <div className="flex flex-col items-start gap-2">
          <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
            Din besparelse over tid
          </span>
          <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
            Se hvor meget du sparer måned for måned
          </span>
        </div>
        <Badge
          className="mobile:self-start"
          variant="success"
          icon={<FeatherArrowUp />}
          data-testid="badge-total-10-years"
        >
          {formatCurrencyShort(tenYearSavings)} over 10 år
        </Badge>
      </div>
      <AreaChart
        className="mobile:h-64 mobile:flex-none"
        categories={categories}
        data={data}
        index="Måned"
        yAxis={<SubframeCore.YAxis tickFormatter={tickFormatter} />}
      />
      <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-row mobile:flex-wrap mobile:gap-3">
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
          <span className="text-caption font-caption text-subtext-color">
            Månedlig besparelse
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3"
            data-testid="text-monthly-savings"
          >
            {formatCurrencyShort(monthlySavings)}
          </span>
        </div>
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
          <span className="text-caption font-caption text-subtext-color">
            Total efter 12 måneder
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3"
            data-testid="text-12-months-savings"
          >
            {formatCurrencyShort(annualSavings)} spart
          </span>
        </div>
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
          <span className="text-caption font-caption text-subtext-color">
            Forventet efter 10 år
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3"
            data-testid="text-10-years-savings"
          >
            {formatCurrencyShort(tenYearSavings)} spart
          </span>
        </div>
      </div>
    </div>
  );
}
