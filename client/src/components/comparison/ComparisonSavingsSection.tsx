import { AreaChart } from "@/ui/components/AreaChart";
import { Badge } from "@/ui/components/Badge";
import { FeatherArrowUp } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { SavingsOverTimeView } from "@/utils/transformComparison";

interface ComparisonSavingsSectionProps {
  savings: SavingsOverTimeView;
}

function formatCurrencyShort(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount)) + " kr";
}

export function ComparisonSavingsSection({ savings }: ComparisonSavingsSectionProps) {
  // Format chart data for AreaChart component
  const chartData = savings.chartPoints.map((point) => ({
    periode: point.x,
    Besparelse: Math.round(point.y),
  }));

  const monthlySavingsText = `${savings.monthlySavingsRange.min}-${savings.monthlySavingsRange.max} kr`;

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
            Se hvor meget du sparer år for år
          </span>
        </div>
        <Badge
          className="mobile:self-start"
          variant="success"
          icon={<FeatherArrowUp />}
          data-testid="badge-total-10-years"
        >
          {formatCurrencyShort(savings.total10Years)} over 10 år
        </Badge>
      </div>
      <AreaChart
        className="mobile:h-64 mobile:flex-none"
        categories={["Besparelse"]}
        data={chartData}
        index="periode"
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
            {monthlySavingsText}
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
            {formatCurrencyShort(savings.total12Months)} spart
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
            {formatCurrencyShort(savings.total10Years)} spart
          </span>
        </div>
      </div>
    </div>
  );
}
