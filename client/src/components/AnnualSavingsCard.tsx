import { Badge } from "@/ui";
import { FeatherTrendingUp, FeatherTrendingDown } from "@subframe/core";

interface AnnualSavingsCardProps {
  annualSavings: number;
  savingsPercentage: number;
  currentPremium: number;
  offerPremium: number;
  variant?: "success" | "warning" | "error";
}

export function AnnualSavingsCard({
  annualSavings,
  savingsPercentage,
  currentPremium,
  offerPremium,
  variant = "success"
}: AnnualSavingsCardProps) {
  const isPositiveSavings = annualSavings >= 0;
  const absoluteSavings = Math.abs(annualSavings);
  const absolutePercentage = Math.abs(savingsPercentage);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' kr';
  };

  const bgColors: { [key: string]: string } = {
    success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
  };

  const textColors: { [key: string]: string } = {
    success: 'text-green-700 dark:text-green-400',
    warning: 'text-yellow-700 dark:text-yellow-400',
    error: 'text-red-700 dark:text-red-400'
  };

  const actualVariant = isPositiveSavings ? variant : "error";

  return (
    <div 
      className={`flex flex-col gap-4 p-6 rounded-lg border-2 ${bgColors[actualVariant]}`}
      data-testid="annual-savings-card"
    >
      <div className="flex items-center justify-between">
        <span className="text-heading-3 font-heading-3 text-default-font">
          {isPositiveSavings ? 'Årlig besparelse' : 'Årlig meromkostning'}
        </span>
        <Badge 
          variant={actualVariant}
          icon={isPositiveSavings ? <FeatherTrendingUp /> : <FeatherTrendingDown />}
          data-testid="savings-badge"
        >
          {absolutePercentage.toFixed(1)}%
        </Badge>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-heading-1 font-heading-1 ${textColors[actualVariant]} mobile:text-heading-2 mobile:font-heading-2`} data-testid="savings-amount">
          {formatCurrency(absoluteSavings)}
        </span>
        <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
          {isPositiveSavings ? 'sparet' : 'dyrere'} per år
        </span>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex justify-between items-center">
          <span className="text-body font-body text-subtext-color">
            Nuværende pris
          </span>
          <span className="text-body-bold font-body-bold text-default-font" data-testid="current-premium">
            {formatCurrency(currentPremium)}/år
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-body font-body text-subtext-color">
            Ny pris
          </span>
          <span className="text-body-bold font-body-bold text-default-font" data-testid="offer-premium">
            {formatCurrency(offerPremium)}/år
          </span>
        </div>
      </div>
    </div>
  );
}
