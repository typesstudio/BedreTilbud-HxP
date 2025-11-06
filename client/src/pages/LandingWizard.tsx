import { SubframeProgress } from "@/components/wizard/SubframeProgress";
import { SubframeStep1 } from "@/components/wizard/SubframeStep1";
import { SubframeStep2 } from "@/components/wizard/SubframeStep2";
import { SubframeStep3 } from "@/components/wizard/SubframeStep3";
import { useWizardFlow } from "@/hooks/useWizardFlow";

export default function LandingWizard() {
  const {
    currentStep,
    isProcessingStep1,
    handleStep1Complete,
    handleStep2Complete,
    handleStep3Complete
  } = useWizardFlow();

  const handleBack = () => {
    // Navigate back logic can be added if needed
  };

  return (
    <div className="flex h-full w-full flex-col items-center bg-default-background min-h-screen">
      <div className="flex w-full flex-col items-center gap-12">
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-6 py-4">
          <span className="text-body-bold font-body-bold text-default-font">
            Bedretilbud.com
          </span>
          <span className="text-body font-body text-subtext-color">
            Få bedre tilbud på under 2 minutter
          </span>
        </div>

        <div className="flex w-full max-w-[768px] flex-col items-start gap-8 px-4">
          <SubframeProgress currentStep={currentStep} completedSteps={currentStep > 1 ? [1] : []} />

          {currentStep === 1 && (
            <SubframeStep1 onComplete={handleStep1Complete} isLoading={isProcessingStep1} />
          )}

          {currentStep === 2 && (
            <SubframeStep2 
              onComplete={handleStep2Complete} 
              onBack={handleBack}
              isLoading={false} 
            />
          )}

          {currentStep === 3 && (
            <SubframeStep3 
              onComplete={(data) => handleStep3Complete(
                data.selectedCompanyIds,
                data.name,
                data.cpr,
                data.priority
              )} 
              onBack={handleBack}
              isLoading={false}
              uploadSkipped={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
