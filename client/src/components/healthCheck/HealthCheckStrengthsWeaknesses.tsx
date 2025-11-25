import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherCheck, FeatherAlertCircle } from "@subframe/core";

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
  const hasContent = (strengths && strengths.length > 0) || (weaknesses && weaknesses.length > 0);
  
  if (!hasContent) return null;

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:px-4 mobile:py-4">
      <span className="text-heading-2 font-heading-2 text-default-font mobile:text-heading-3 mobile:font-heading-3">
        Styrker & svagheder
      </span>

      <div className="flex w-full items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
        {/* Strengths Column */}
        {strengths && strengths.length > 0 && (
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3 mobile:w-full">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="success"
                size="small"
                icon={<FeatherCheck />}
              />
              <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                Styrker
              </span>
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              {strengths.map((item) => (
                <div
                  key={item.id}
                  className="flex w-full flex-col items-start gap-1 rounded-md border border-solid border-success-200 bg-success-50 px-4 py-3"
                  data-testid={`strength-${item.id}`}
                >
                  <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="text-body font-body text-default-font mobile:text-caption mobile:font-caption">
                      {item.description}
                    </span>
                  )}
                  {item.amountText && (
                    <span className="text-caption font-caption text-success-700">
                      {item.amountText}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weaknesses Column */}
        {weaknesses && weaknesses.length > 0 && (
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3 mobile:w-full">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="warning"
                size="small"
                icon={<FeatherAlertCircle />}
              />
              <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                Forbedringsmuligheder
              </span>
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              {weaknesses.map((item) => (
                <div
                  key={item.id}
                  className="flex w-full flex-col items-start gap-1 rounded-md border border-solid border-warning-200 bg-warning-50 px-4 py-3"
                  data-testid={`weakness-${item.id}`}
                >
                  <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="text-body font-body text-default-font mobile:text-caption mobile:font-caption">
                      {item.description}
                    </span>
                  )}
                  {item.amountText && (
                    <span className="text-caption font-caption text-warning-700">
                      {item.amountText}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
