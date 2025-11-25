import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { 
  FeatherClock, 
  FeatherZap, 
  FeatherStar, 
  FeatherCheckCircle,
  FeatherShield
} from "@subframe/core";

export interface HealthCheckBenefit {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  variant?: "success" | "neutral" | "warning" | "error";
}

interface HealthCheckBenefitsGridProps {
  benefits: HealthCheckBenefit[];
}

function getIconForBenefit(benefit: HealthCheckBenefit) {
  const title = benefit.title.toLowerCase();
  
  if (title.includes("24/7") || title.includes("service")) {
    return <FeatherClock />;
  } else if (title.includes("udbetaling") || title.includes("hurtig")) {
    return <FeatherZap />;
  } else if (title.includes("stjern") || title.includes("bedømt")) {
    return <FeatherStar />;
  } else if (title.includes("autoriseret") || title.includes("certificeret")) {
    return <FeatherCheckCircle />;
  } else {
    return <FeatherShield />;
  }
}

export function HealthCheckBenefitsGrid({ benefits }: HealthCheckBenefitsGridProps) {
  if (!benefits || benefits.length === 0) return null;

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:px-4 mobile:py-4">
      <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
        Dine forsikringsfordele
      </span>
      <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-col mobile:flex-nowrap mobile:gap-3">
        {benefits.map((benefit) => (
          <div
            key={benefit.id}
            className="flex grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4 min-w-[200px] mobile:w-full mobile:min-w-0"
            data-testid={`benefit-${benefit.id}`}
          >
            <IconWithBackground
              variant={benefit.variant || "neutral"}
              size="medium"
              icon={getIconForBenefit(benefit)}
              square={true}
            />
            <div className="flex flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                {benefit.title}
              </span>
              {benefit.description && (
                <span className="text-caption font-caption text-subtext-color">
                  {benefit.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
