import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherArrowRight, FeatherPiggyBank } from "@subframe/core";

interface ComparisonAnnualCostProps {
  currentCompanyName: string;
  offerCompanyName: string;
  currentAnnual: number;
  offerAnnual: number;
  annualSavings: number;
  savingsPercent: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount)) + " kr";
}

export function ComparisonAnnualCost({
  currentCompanyName,
  offerCompanyName,
  currentAnnual,
  offerAnnual,
  annualSavings,
  savingsPercent,
}: ComparisonAnnualCostProps) {
  const isPositiveSavings = annualSavings != null && annualSavings > 0;
  const isNegativeSavings = annualSavings != null && annualSavings < 0;
  
  const getContainerClasses = () => {
    if (isPositiveSavings) return 'border-success-200 bg-success-50';
    if (isNegativeSavings) return 'border-error-200 bg-error-50';
    return 'border-neutral-200 bg-neutral-50';
  };

  const getTextColorClass = () => {
    if (isPositiveSavings) return 'text-success-600';
    if (isNegativeSavings) return 'text-error-600';
    return 'text-default-font';
  };

  const getSavingsDisplay = () => {
    if (annualSavings == null) return "Afventer";
    if (annualSavings === 0) return "0 kr";
    if (isPositiveSavings) return formatCurrency(annualSavings);
    return `-${formatCurrency(Math.abs(annualSavings))}`;
  };

  const getSavingsPercentLabel = () => {
    if (savingsPercent == null) return "";
    if (isPositiveSavings) return `${Math.abs(savingsPercent).toFixed(1)}% lavere omkostning`;
    if (isNegativeSavings) return `${Math.abs(savingsPercent).toFixed(1)}% højere omkostning`;
    return "";
  };

  const getIconVariant = (): "success" | "error" | "neutral" => {
    if (isPositiveSavings) return "success";
    if (isNegativeSavings) return "error";
    return "neutral";
  };
  
  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
      <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
        Årlig omkostning sammenligning
      </span>
      <div className={`flex w-full items-center justify-between rounded-lg border border-solid px-6 py-4 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2 mobile:px-4 mobile:py-3 ${getContainerClasses()}`}>
        <span 
          className={`text-heading-1 font-heading-1 mobile:text-heading-2 mobile:font-heading-2 mobile:self-end ${getTextColorClass()}`}
          data-testid="text-annual-savings-amount"
        >
          {getSavingsDisplay()}
        </span>
        <div className="flex items-center gap-3">
          <IconWithBackground
            variant={getIconVariant()}
            size="medium"
            icon={<FeatherPiggyBank />}
          />
          <div className="flex flex-col items-start gap-1">
            <span className={`text-body-bold font-body-bold ${isPositiveSavings ? 'text-success-700' : isNegativeSavings ? 'text-error-700' : 'text-default-font'}`}>
              {isPositiveSavings ? 'Din årlige besparelse' : isNegativeSavings ? 'Årlig meromkostning' : 'Prissammenligning'}
            </span>
            <span 
              className={`text-caption font-caption ${getTextColorClass()}`}
              data-testid="text-savings-percentage"
            >
              {getSavingsPercentLabel()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex w-full items-center gap-4 mobile:flex-col mobile:gap-3">
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-50 px-4 py-4 mobile:w-full">
          <span className="text-caption font-caption text-subtext-color">
            Nuværende ({currentCompanyName})
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-default-font"
            data-testid="text-current-annual-cost"
          >
            {formatCurrency(currentAnnual)}
          </span>
        </div>
        <FeatherArrowRight className={`text-heading-2 font-heading-2 mobile:hidden ${getTextColorClass()}`} />
        <div className={`flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md px-4 py-4 mobile:w-full ${isPositiveSavings ? 'bg-success-50' : isNegativeSavings ? 'bg-error-50' : 'bg-neutral-50'}`}>
          <span className={`text-caption font-caption ${getTextColorClass()}`}>
            Ny pris ({offerCompanyName})
          </span>
          <span 
            className={`text-heading-2 font-heading-2 ${isPositiveSavings ? 'text-success-700' : isNegativeSavings ? 'text-error-700' : 'text-default-font'}`}
            data-testid="text-offer-annual-cost"
          >
            {formatCurrency(offerAnnual)}
          </span>
        </div>
      </div>
    </div>
  );
}
