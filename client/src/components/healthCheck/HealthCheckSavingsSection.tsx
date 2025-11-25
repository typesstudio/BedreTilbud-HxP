import { AreaChart } from "@/ui/components/AreaChart";
import { Badge } from "@/ui/components/Badge";
import { FeatherArrowUp, FeatherPiggyBank } from "@subframe/core";

interface HealthCheckSavingsSectionProps {
  savingsOverTime: {
    chartData: { label: string; Besparelse: number }[];
    monthlyRangeText?: string;
    totalAfter12Months: number;
    totalAfter10Years: number;
  };
}

export function HealthCheckSavingsSection({ savingsOverTime }: HealthCheckSavingsSectionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  const monthlySavings = savingsOverTime.totalAfter12Months / 12;
  const monthlyRangeStart = Math.floor(monthlySavings * 0.9);
  const monthlyRangeEnd = Math.ceil(monthlySavings * 1.1);

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex flex-col items-start gap-2">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Kumulativ besparelse
          </span>
          <span className="text-body font-body text-subtext-color">
            Se hvor meget du sparer måned for måned
          </span>
        </div>
        <Badge variant="success" icon={<FeatherArrowUp />}>
          {formatCurrency(savingsOverTime.totalAfter10Years)} over 10 år
        </Badge>
      </div>

      <div className="w-full h-64">
        <AreaChart
          categories={["Besparelse"]}
          data={savingsOverTime.chartData}
          index="label"
        />
      </div>

      <div className="flex w-full items-start gap-4 flex-wrap">
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
          <span className="text-caption font-caption text-subtext-color">
            Månedlig besparelse
          </span>
          <span className="text-heading-2 font-heading-2 text-success-600">
            {savingsOverTime.monthlyRangeText || `${monthlyRangeStart}-${monthlyRangeEnd} kr`}
          </span>
        </div>
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
          <span className="text-caption font-caption text-subtext-color">
            Total efter 12 måneder
          </span>
          <span className="text-heading-2 font-heading-2 text-success-600">
            {formatCurrency(savingsOverTime.totalAfter12Months)} spart
          </span>
        </div>
        <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4">
          <span className="text-caption font-caption text-subtext-color">
            Forventet efter 10 år
          </span>
          <span className="text-heading-2 font-heading-2 text-success-600">
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
