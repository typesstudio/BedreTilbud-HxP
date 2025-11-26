import { useState } from "react";
import { AreaChart } from "@/ui/components/AreaChart";
import { Badge } from "@/ui/components/Badge";
import * as SubframeCore from "@subframe/core";
import { FeatherArrowUp, FeatherPiggyBank } from "@subframe/core";

interface HealthCheckSavingsSectionProps {
  savingsOverTime: {
    chartData: { label: string; Besparelse: number }[];
    monthlyRangeText?: string;
    totalAfter12Months: number;
    totalAfter10Years: number;
  };
  policyType?: string;
  policyTypeLabel?: string;
}

const POLICY_COLORS: Record<string, string> = {
  hus: "#10b981",
  indbo: "#14b8a6",
  ulykke: "#06b6d4",
  bil: "#8b5cf6",
  rejse: "#f59e0b",
  fritidshus: "#10b981",
};

function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + " kr";
}

function monthToYearLabel(monthIndex: number): string {
  const year = Math.ceil(monthIndex / 12);
  return `${year}. år`;
}

function tooltipFormatter(value: number): string {
  return formatCurrency(value);
}

export function HealthCheckSavingsSection({ 
  savingsOverTime, 
  policyType = "indbo",
  policyTypeLabel = "Indbo"
}: HealthCheckSavingsSectionProps) {
  const [isVisible, setIsVisible] = useState(true);

  const monthlySavings = savingsOverTime.totalAfter12Months / 12;
  const monthlyRangeStart = Math.floor(monthlySavings * 0.9);
  const monthlyRangeEnd = Math.ceil(monthlySavings * 1.1);

  const seriesColor = POLICY_COLORS[policyType] || "#10b981";

  const tickFormatter = (value: number) => {
    return formatCurrency(value);
  };

  const chartData = savingsOverTime.chartData.map((point, index) => ({
    Year: monthToYearLabel(index + 1),
    [policyTypeLabel]: Math.round(point.Besparelse),
  }));

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4 mobile:px-4 mobile:py-4">
      <div className="flex w-full items-center justify-between mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-3">
        <div className="flex flex-col items-start gap-2">
          <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
            Kumulativ besparelse
          </span>
          <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
            Se hvor meget du sparer år for år
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mobile:self-start">
          <button
            type="button"
            onClick={toggleVisibility}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-caption font-caption transition ${
              isVisible
                ? "border-success-500 bg-success-50 text-success-700"
                : "border-neutral-border bg-neutral-50 text-subtext-color hover:bg-neutral-100"
            }`}
            data-testid={`legend-toggle-${policyType}`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: seriesColor }}
              aria-hidden="true"
            />
            {policyTypeLabel}
          </button>
        </div>
      </div>

      <div className="w-full [&_.recharts-legend-wrapper]:hidden">
        {isVisible ? (
          <AreaChart
            className="mobile:h-64 mobile:flex-none"
            categories={[policyTypeLabel]}
            data={chartData}
            index="Year"
            colors={[seriesColor]}
            yAxis={<SubframeCore.YAxis tickFormatter={tickFormatter} />}
            tooltip={<SubframeCore.ChartTooltip formatter={tooltipFormatter} />}
          />
        ) : (
          <div className="flex h-64 w-full items-center justify-center rounded-md bg-neutral-50 mobile:h-48">
            <span className="text-body font-body text-subtext-color">
              Klik på "{policyTypeLabel}" for at vise grafen
            </span>
          </div>
        )}
      </div>

      <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-row mobile:flex-wrap mobile:gap-3">
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
          <span className="text-caption font-caption text-subtext-color">
            Månedlig besparelse
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3"
            data-testid="text-monthly-savings"
          >
            {savingsOverTime.monthlyRangeText || `${monthlyRangeStart}-${monthlyRangeEnd} kr`}
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
            {formatCurrency(savingsOverTime.totalAfter12Months)} spart
          </span>
        </div>
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
          <span className="text-caption font-caption text-subtext-color">
            Total efter 10 år
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3"
            data-testid="text-10-years-savings"
          >
            {formatCurrency(savingsOverTime.totalAfter10Years)} spart
          </span>
        </div>
      </div>

      <div className="flex w-full items-center gap-2 rounded-md bg-success-50 px-4 py-3">
        <FeatherPiggyBank className="text-body font-body text-success-700" />
        <span className="text-body font-body text-default-font">
          Vi låser ind når priserne dykker og maksimerer din besparelse
        </span>
      </div>
    </div>
  );
}
