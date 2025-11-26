import { AreaChart } from "@/ui/components/AreaChart";
import { Badge } from "@/ui/components/Badge";
import * as SubframeCore from "@subframe/core";
import { Tooltip } from "recharts";
import { ComparisonOverallView } from "@/utils/transformComparison";
import { FormattedChartTooltip } from "@/components/ui/FormattedChartTooltip";

interface ComparisonSavingsChartProps {
  overall: ComparisonOverallView;
}

export function ComparisonSavingsChart({ overall }: ComparisonSavingsChartProps) {
  // Don't render if no cumulative savings data
  if (!overall.cumulativeSavings || overall.cumulativeSavings.length === 0) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    const rounded = Math.round(amount);
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return formatted + " kr";
  };

  const tooltipFormatter = (value: number) => formatCurrency(value);

  // Calculate savings milestones
  const monthlySavings = overall.annualSavings / 12;
  const oneYearSavings = overall.annualSavings;
  const tenYearSavings = overall.cumulativeSavings[overall.cumulativeSavings.length - 1]?.value || overall.annualSavings * 10;

  // Transform data for AreaChart with rounded values
  const chartData = overall.cumulativeSavings.map((point) => ({
    label: point.label,
    Besparelse: Math.round(point.value),
  }));

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
      {/* Header */}
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
          Din besparelse
        </span>
        <Badge variant="success">{formatCurrency(tenYearSavings)} over 10 år</Badge>
      </div>

      {/* Chart */}
      <div className="w-full h-64 mobile:h-48">
        <AreaChart
          index="label"
          categories={["Besparelse"]}
          data={chartData}
          className="w-full h-full"
          yAxis={<SubframeCore.YAxis tickFormatter={(value: number) => formatCurrency(value)} />}
          tooltip={<Tooltip content={<FormattedChartTooltip />} />}
        />
      </div>

      {/* Milestone Cards */}
      <div className="flex w-full items-start gap-4 flex-wrap">
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
          <span className="text-caption font-caption text-subtext-color">
            Månedlig besparelse
          </span>
          <span className="text-heading-3 font-heading-3 text-default-font">
            {formatCurrency(monthlySavings)}
          </span>
        </div>
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
          <span className="text-caption font-caption text-subtext-color">
            Total efter 12 måneder
          </span>
          <span className="text-heading-3 font-heading-3 text-default-font">
            {formatCurrency(oneYearSavings)}
          </span>
        </div>
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-50 px-4 py-4">
          <span className="text-caption font-caption text-success-700">
            Forventet efter 10 år
          </span>
          <span className="text-heading-3 font-heading-3 text-success-700">
            {formatCurrency(tenYearSavings)}
          </span>
        </div>
      </div>
    </div>
  );
}
