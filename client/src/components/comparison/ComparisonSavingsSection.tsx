import { useState, useMemo } from "react";
import { AreaChart } from "@/ui/components/AreaChart";
import { Badge } from "@/ui/components/Badge";
import { FeatherArrowUp } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { SavingsOverTimeView } from "@/utils/transformComparison";

interface ComparisonSavingsSectionProps {
  savings: SavingsOverTimeView;
  activePolicyKey: string | "all";
}

// Policy type color mapping
const POLICY_COLORS: Record<string, string> = {
  hus: "#10b981", // emerald-500
  indbo: "#14b8a6", // teal-500
  ulykke: "#06b6d4", // cyan-500
  bil: "#8b5cf6", // violet-500
  rejse: "#f59e0b", // amber-500
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount)) + " kr";
}

function monthToYearLabel(monthIndex: number): string {
  const year = Math.ceil(monthIndex / 12);
  return `${year}. år`;
}

export function ComparisonSavingsSection({ savings, activePolicyKey }: ComparisonSavingsSectionProps) {
  // Determine initial visible series based on activePolicyKey
  const initialVisibleKeys = useMemo(() => {
    if (activePolicyKey === "all") {
      return savings.series.map(s => s.key);
    }
    return savings.series.filter(s => s.key === activePolicyKey).map(s => s.key);
  }, [savings.series, activePolicyKey]);

  const [visibleKeys, setVisibleKeys] = useState<string[]>(initialVisibleKeys);

  // Update visible keys when activePolicyKey changes
  useMemo(() => {
    if (activePolicyKey === "all") {
      setVisibleKeys(savings.series.map(s => s.key));
    } else {
      const filtered = savings.series.filter(s => s.key === activePolicyKey).map(s => s.key);
      setVisibleKeys(filtered.length > 0 ? filtered : visibleKeys);
    }
  }, [activePolicyKey, savings.series]);

  // Filter series
  const visibleSeries = savings.series.filter(s => visibleKeys.includes(s.key));

  if (visibleSeries.length === 0) {
    return null;
  }

  // Build categories and chart data
  const categories = visibleSeries.map(s => s.label);
  
  // Build chart data with Year labels
  const data = Array.from({ length: 120 }, (_, i) => {
    const month = i + 1;
    const row: any = { Year: monthToYearLabel(month) };

    visibleSeries.forEach(s => {
      const point = s.points[i];
      row[s.label] = point?.cumulative ?? 0;
    });

    return row;
  });

  // Calculate summary values
  let monthlySavings: number;
  let annualSavings: number;
  let tenYearSavings: number;

  if (activePolicyKey === "all" || visibleSeries.length > 1) {
    const totals = visibleSeries.reduce(
      (acc, s) => ({
        monthly: acc.monthly + s.monthlySavings,
        annual: acc.annual + s.annualSavings,
        tenYear: acc.tenYear + s.tenYearSavings,
      }),
      { monthly: 0, annual: 0, tenYear: 0 }
    );
    monthlySavings = totals.monthly;
    annualSavings = totals.annual;
    tenYearSavings = totals.tenYear;
  } else {
    const series = visibleSeries[0];
    monthlySavings = series.monthlySavings;
    annualSavings = series.annualSavings;
    tenYearSavings = series.tenYearSavings;
  }

  // Get colors for visible series
  const colors = visibleSeries.map(s => POLICY_COLORS[s.key] || "#10b981");

  // Select a specific series (show only that one)
  const handleSelectSeries = (key: string) => {
    setVisibleKeys([key]);
  };

  // Show all series
  const handleShowAll = () => {
    setVisibleKeys(savings.series.map(s => s.key));
  };

  const isAllSelected = visibleKeys.length === savings.series.length;
  const isSingleSelected = (key: string) => visibleKeys.length === 1 && visibleKeys[0] === key;

  // Value formatter for Y-axis
  const tickFormatter = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " kr";
  };

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4 mobile:px-4 mobile:py-4">
      {/* Header with Legend Filters */}
      <div className="flex w-full items-center justify-between mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-3">
        <div className="flex flex-col items-start gap-2">
          <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
            Din besparelse over tid
          </span>
          <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
            Se hvor meget du sparer år for år
          </span>
        </div>
        
        {/* Interactive Legend Filters */}
        {savings.series.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mobile:self-start">
            <button
              type="button"
              onClick={handleShowAll}
              className={`rounded-full border px-3 py-1 text-caption font-caption transition ${
                isAllSelected
                  ? "border-success-500 bg-success-50 text-success-700"
                  : "border-neutral-border bg-neutral-50 text-subtext-color hover:bg-neutral-100"
              }`}
              data-testid="legend-toggle-all"
            >
              Alle
            </button>
            {savings.series.map(series => {
              const isSelected = isSingleSelected(series.key);
              const color = POLICY_COLORS[series.key] || "#10b981";
              
              return (
                <button
                  key={series.key}
                  type="button"
                  onClick={() => handleSelectSeries(series.key)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-caption font-caption transition ${
                    isSelected
                      ? "border-success-500 bg-success-50 text-success-700"
                      : "border-neutral-border bg-neutral-50 text-subtext-color hover:bg-neutral-100"
                  }`}
                  data-testid={`legend-toggle-${series.key}`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  {series.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full [&_.recharts-legend-wrapper]:hidden">
        <AreaChart
          className="mobile:h-64 mobile:flex-none"
          categories={categories}
          data={data}
          index="Year"
          colors={colors}
          yAxis={<SubframeCore.YAxis tickFormatter={tickFormatter} />}
        />
      </div>

      {/* Summary Cards */}
      <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-row mobile:flex-wrap mobile:gap-3">
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:min-w-full">
          <span className="text-caption font-caption text-subtext-color">
            Månedlig besparelse
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-success-600 mobile:text-heading-3 mobile:font-heading-3"
            data-testid="text-monthly-savings"
          >
            {formatCurrency(monthlySavings)}
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
            {formatCurrency(annualSavings)} spart
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
            {formatCurrency(tenYearSavings)} spart
          </span>
        </div>
      </div>
    </div>
  );
}
