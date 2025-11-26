import { TooltipProps } from "recharts";

interface FormattedChartTooltipProps extends Omit<TooltipProps<number, string>, 'content'> {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    dataKey?: string;
  }>;
  label?: string;
  formatter?: (value: number) => string;
}

function formatDanishCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + " kr";
}

export function FormattedChartTooltip({ 
  active, 
  payload, 
  label,
  formatter = formatDanishCurrency 
}: FormattedChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-md">
      {label && (
        <div className="mb-1 text-sm font-medium text-neutral-700">
          {label}
        </div>
      )}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span 
            className="h-2 w-2 rounded-full" 
            style={{ backgroundColor: entry.color || '#14b8a6' }}
          />
          <span className="text-neutral-600">{entry.name}</span>
          <span className="font-medium text-neutral-900">
            {formatter(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
