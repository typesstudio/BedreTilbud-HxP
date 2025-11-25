import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherPiggyBank } from "@subframe/core";

interface HealthCheckAnnualPotentialCardProps {
  annualPotentialSavings: number;
  annualSavingsPercent?: number;
}

export function HealthCheckAnnualPotentialCard({
  annualPotentialSavings,
  annualSavingsPercent,
}: HealthCheckAnnualPotentialCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:px-4 mobile:py-4">
      <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
        Årlig potentiel besparelse
      </span>
      <div className="flex w-full items-center justify-between rounded-lg border border-solid border-success-200 bg-success-50 px-6 py-4 mobile:flex-col mobile:items-start mobile:gap-3 mobile:px-4 mobile:py-3">
        <span className="text-heading-1 font-heading-1 text-success-600 mobile:text-heading-2 mobile:font-heading-2" data-testid="text-annual-potential-savings">
          {formatCurrency(annualPotentialSavings)}
        </span>
        <div className="flex items-center gap-3">
          <IconWithBackground
            variant="success"
            size="medium"
            icon={<FeatherPiggyBank />}
          />
          <div className="flex flex-col items-start gap-1">
            <span className="text-body-bold font-body-bold text-success-700 mobile:text-caption-bold mobile:font-caption-bold">
              Din årlige besparelse
            </span>
            {annualSavingsPercent != null && (
              <span className="text-caption font-caption text-success-600">
                {annualSavingsPercent.toFixed(1)}% lavere omkostning
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
