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
  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
      <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
        Årlig omkostning sammenligning
      </span>
      <div className="flex w-full items-center justify-between rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2 mobile:px-4 mobile:py-3">
        <span 
          className="text-heading-1 font-heading-1 text-success-600 mobile:text-heading-2 mobile:font-heading-2 mobile:self-end"
          data-testid="text-annual-savings-amount"
        >
          {formatCurrency(annualSavings)}
        </span>
        <div className="flex items-center gap-3">
          <IconWithBackground
            variant="success"
            size="medium"
            icon={<FeatherPiggyBank />}
          />
          <div className="flex flex-col items-start gap-1">
            <span className="text-body-bold font-body-bold text-success-700">
              Din årlige besparelse
            </span>
            <span 
              className="text-caption font-caption text-success-600"
              data-testid="text-savings-percentage"
            >
              {savingsPercent.toFixed(1)}% lavere omkostning
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
        <FeatherArrowRight className="text-heading-2 font-heading-2 text-success-600 mobile:hidden" />
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-50 px-4 py-4 mobile:w-full">
          <span className="text-caption font-caption text-success-600">
            Ny pris ({offerCompanyName})
          </span>
          <span 
            className="text-heading-2 font-heading-2 text-success-700"
            data-testid="text-offer-annual-cost"
          >
            {formatCurrency(offerAnnual)}
          </span>
        </div>
      </div>
    </div>
  );
}
