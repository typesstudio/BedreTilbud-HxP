import { IconWithBackground } from "../../../../src/ui/components/IconWithBackground";
import { FeatherUpload, FeatherCheckCircle } from "@subframe/core";

interface SubframeProgressProps {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
}

export function SubframeProgress({ currentStep, completedSteps }: SubframeProgressProps) {
  const step1Complete = completedSteps.includes(1);
  const step2Complete = completedSteps.includes(2);

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <IconWithBackground variant={step1Complete ? "success" : currentStep === 1 ? "brand" : "neutral"} />
        <span className={`text-body-bold font-body-bold ${currentStep === 1 ? 'text-brand-600' : step1Complete ? 'text-default-font' : 'text-subtext-color'}`}>
          Din Email
        </span>
      </div>
      <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
      <div className="flex items-center gap-2">
        <IconWithBackground 
          variant={step2Complete ? "success" : currentStep === 2 ? "brand" : "neutral"} 
          icon={<FeatherUpload />} 
        />
        <span className={`text-body-bold font-body-bold ${currentStep === 2 ? 'text-brand-600' : step2Complete ? 'text-default-font' : 'text-subtext-color'}`}>
          Upload Police
        </span>
      </div>
      <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
      <div className="flex items-center gap-2">
        <IconWithBackground 
          variant={currentStep === 3 ? "brand" : "neutral"} 
          icon={<FeatherCheckCircle />} 
        />
        <span className={`text-body-bold font-body-bold ${currentStep === 3 ? 'text-brand-600' : 'text-subtext-color'}`}>
          Vælg Selskaber
        </span>
      </div>
    </div>
  );
}
