import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
}

export function WizardProgress({ currentStep, completedSteps }: WizardProgressProps) {
  const steps = [
    { number: 1, label: "Email" },
    { number: 2, label: "Upload" },
    { number: 3, label: "Vælg" },
  ];

  const getStepStatus = (stepNumber: number) => {
    if (completedSteps.includes(stepNumber)) return "completed";
    if (stepNumber === currentStep) return "current";
    return "upcoming";
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.number);
          
          return (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  data-testid={`wizard-step-${step.number}`}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold transition-colors",
                    status === "completed" && "bg-green-600 text-white",
                    status === "current" && "bg-blue-600 text-white ring-4 ring-blue-200",
                    status === "upcoming" && "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  )}
                >
                  {status === "completed" ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </div>
                <span className={cn(
                  "mt-2 text-sm font-medium",
                  status === "current" && "text-blue-600 dark:text-blue-400",
                  status === "completed" && "text-green-600 dark:text-green-400",
                  status === "upcoming" && "text-gray-500 dark:text-gray-400"
                )}>
                  {step.label}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className={cn(
                  "h-1 flex-1 mx-2 mt-[-32px]",
                  completedSteps.includes(step.number) ? "bg-green-600" : "bg-gray-200 dark:bg-gray-700"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
