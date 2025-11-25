import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherCheck, FeatherAlertCircle, FeatherCheckCircle, FeatherAlertTriangle } from "@subframe/core";

export interface HealthCheckItem {
  id: string;
  title: string;
  description?: string;
  amountText?: string;
}

interface HealthCheckStrengthsWeaknessesProps {
  strengths: HealthCheckItem[];
  weaknesses: HealthCheckItem[];
}

export function HealthCheckStrengthsWeaknesses({
  strengths,
  weaknesses,
}: HealthCheckStrengthsWeaknessesProps) {
  const hasStrengths = strengths && strengths.length > 0;
  const hasWeaknesses = weaknesses && weaknesses.length > 0;
  const hasContent = hasStrengths || hasWeaknesses;
  
  if (!hasContent) {
    return (
      <div 
        className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6"
        data-testid="strengths-weaknesses-section"
      >
        <span className="text-heading-2 font-heading-2 text-default-font">
          Styrker & svagheder
        </span>
        <div className="flex w-full items-center justify-center py-8">
          <span className="text-body font-body text-subtext-color">
            Ingen styrker eller svagheder identificeret for denne forsikring.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6"
      data-testid="strengths-weaknesses-section"
    >
      <span className="text-heading-2 font-heading-2 text-default-font">
        Styrker & svagheder
      </span>
      <div className="flex w-full items-start gap-4">
        {/* Strengths Column */}
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3">
          <div className="flex items-center gap-2">
            <IconWithBackground
              variant="success"
              size="small"
              icon={<FeatherCheckCircle />}
            />
            <span className="text-body-bold font-body-bold text-success-700">
              Styrker
            </span>
          </div>
          <div className="flex w-full flex-col items-start gap-2">
            {hasStrengths ? (
              strengths.map((item) => (
                <div
                  key={item.id}
                  className="flex w-full items-start gap-2 rounded-md border border-solid border-success-200 bg-success-50 px-3 py-3"
                  data-testid={`strength-${item.id}`}
                >
                  <FeatherCheck className="text-body font-body text-success-600 mt-0.5 flex-shrink-0" />
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      {item.title}
                    </span>
                    {item.description && (
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex w-full items-center justify-center py-4 rounded-md bg-neutral-50">
                <span className="text-caption font-caption text-subtext-color">
                  Ingen styrker identificeret
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Weaknesses Column */}
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3">
          <div className="flex items-center gap-2">
            <IconWithBackground
              variant="warning"
              size="small"
              icon={<FeatherAlertTriangle />}
            />
            <span className="text-body-bold font-body-bold text-warning-700">
              Forbedringsmuligheder
            </span>
          </div>
          <div className="flex w-full flex-col items-start gap-2">
            {hasWeaknesses ? (
              weaknesses.map((item) => (
                <div
                  key={item.id}
                  className="flex w-full items-start gap-2 rounded-md border border-solid border-warning-200 bg-warning-50 px-3 py-3"
                  data-testid={`weakness-${item.id}`}
                >
                  <FeatherAlertCircle className="text-body font-body text-warning-600 mt-0.5 flex-shrink-0" />
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      {item.title}
                    </span>
                    {item.description && (
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex w-full items-center justify-center py-4 rounded-md bg-neutral-50">
                <span className="text-caption font-caption text-subtext-color">
                  Ingen forbedringsmuligheder identificeret
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
